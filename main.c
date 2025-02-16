#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>
#include <string.h>
#include <sys/socket.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include <limits.h>
#include <sys/un.h>
#include <fcntl.h>
#include <libgen.h>
#include <signal.h>
#include "quickjs.h"
#include "quickjs-libc.h"

// 定义一个全局的JSContext*，用于存储QuickJS的上下文
JSContext *ctx;
JSValue global_obj;

// 连接处理函数
void handle_connection(int client_fd, char *addr) {
    // 将文件描述符转换为JSValue
    JSValue fd_value = JS_NewInt32(ctx, client_fd);
    // 调用全局的onAccept函数
    JSValue onAccept = JS_GetPropertyStr(ctx, global_obj, "onAccept");
    JSValue result = JS_Call(ctx, onAccept, global_obj, 1, &fd_value);
    if(JS_IsException(result)) {
        fputs("Exception in onAccept callback\n", stderr);
        js_std_dump_error(ctx);
        JS_FreeValue(ctx, result);

        // 500
        char response[] = "HTTP/1.1 500 Internal Server Error\r\nConnection: close\r\n\r\n";
        send(client_fd, response, strlen(response), 0);
        close(client_fd);
        return;
    }
    JS_FreeValue(ctx, result);
    // 释放fd_value
    JS_FreeValue(ctx, fd_value);
}

int server_fd;

// 监听TCP socket
void listen_tcp(const char *port) {
    int new_socket;
    struct sockaddr_in address;
    int addrlen = sizeof(address);

    // 创建socket文件描述符
    if ((server_fd = socket(AF_INET, SOCK_STREAM, 0)) == 0) {
        perror("socket failed");
        exit(EXIT_FAILURE);
    }

    // 绑定socket
    address.sin_family = AF_INET;
    address.sin_addr.s_addr = INADDR_ANY;
    address.sin_port = htons(atoi(port));

    if (bind(server_fd, (struct sockaddr *)&address, sizeof(address)) < 0) {
        perror("bind failed");
        exit(EXIT_FAILURE);
    }

    // 监听
    if (listen(server_fd, 3) < 0) {
        perror("listen");
        exit(EXIT_FAILURE);
    }

    printf("Listening on port %s\n", port);

    // 主循环，接受连接并传递给JavaScript
    while (1) {
        if ((new_socket = accept(server_fd, (struct sockaddr *)&address, (socklen_t*)&addrlen)) < 0) {
            perror("accept");
            exit(EXIT_FAILURE);
        }
        handle_connection(new_socket, inet_ntoa(address.sin_addr));
    }
}

// 监听UNIX socket
void listen_unix(const char *path) {
    int new_socket;
    struct sockaddr_un address;
    unlink(path);

    // 创建socket文件描述符
    if ((server_fd = socket(AF_UNIX, SOCK_STREAM, 0)) == 0) {
        perror("socket failed");
        exit(EXIT_FAILURE);
    }

    // 绑定socket
    address.sun_family = AF_UNIX;
    strcpy(address.sun_path, path);

    if (bind(server_fd, (struct sockaddr *)&address, sizeof(address)) < 0) {
        perror("bind failed");
        exit(EXIT_FAILURE);
    }

    // 监听
    if (listen(server_fd, 3) < 0) {
        perror("listen");
        exit(EXIT_FAILURE);
    }

    printf("Listening on UNIX socket %s\n", path);

    // 主循环，接受连接并传递给JavaScript
    while (1) {
        if ((new_socket = accept(server_fd, NULL, NULL)) < 0) {
            perror("accept");
            exit(EXIT_FAILURE);
        }
        handle_connection(new_socket, "UNIX socket");
    }
}

void signal_handler(int signum) {
    printf("\nReceived signal %d, exiting...\n", signum);
    close(server_fd);
    exit(0);
}

/* also used to initialize the worker context */
static JSContext *JS_GetCtx(JSRuntime *rt)
{
    // 初始化新的JSContext
    JSContext *ctx = JS_NewContext(rt);
    if (!ctx){
        return NULL;
    }
    js_std_add_helpers(ctx, 0, NULL);
    js_init_module_std(ctx, "std");
    js_init_module_os(ctx, "os");
    js_init_module_bjson(ctx, "bjson");
    // parent变量
    JSValue global = JS_GetGlobalObject(ctx);
    JS_SetPropertyStr(ctx, global, "parent", global_obj);
    return ctx;
}


int main(int argc, char *argv[]) {
    if (argc != 3) {
        printf("Usage: %s [uds:path|tcp:port] [script] [...more args for script]\n", argv[0]);
        return 1;
    }

    uint8_t exit_code = 0;
    signal(SIGTERM, signal_handler);
    signal(SIGINT, signal_handler);

    // 初始化QuickJS运行环境
    JSRuntime *rt = JS_NewRuntime();
    if(!rt){
        fputs("Failed to create runtime\n", stderr);
        exit_code = 1;
        goto fail;
    }
    ctx = JS_NewContext(rt);
    global_obj = JS_GetGlobalObject(ctx);
    if(!ctx){
        fputs("Failed to create context\n", stderr);
        exit_code = 1;
        goto fail;
    }
    js_std_add_helpers(ctx, argc-3, argv+3);
    JS_SetModuleLoaderFunc(rt, NULL, js_module_loader, NULL);
    JS_SetHostPromiseRejectionTracker(rt, js_std_promise_rejection_tracker, NULL);
    js_std_set_worker_new_context_func(JS_GetCtx);
    js_std_init_handlers(rt);
    js_init_module_std(ctx, "std");
    js_init_module_os(ctx, "os");
    js_init_module_bjson(ctx, "bjson");

    // 读取并执行JavaScript文件
    size_t buf_len;
    uint8_t *buf = js_load_file(ctx, &buf_len, argv[2]);
    if (!buf) {
        fputs("Failed to load script\n", stderr);
        exit_code = 2;
        goto fail;
    }

    // 设置import.meta
    JSValue process = JS_NewObject(ctx);
    char* rpath;
#ifdef _WIN32
    _fullpath(rpath, argv[2], PATH_MAX);
#else
rpath = realpath(argv[2], NULL);
#endif
    JS_SetPropertyStr(ctx, process, "entry", JS_NewString(ctx, rpath));
    JS_SetPropertyStr(ctx, process, "dirname", JS_NewString(ctx, dirname(rpath)));
    JS_SetPropertyStr(ctx, process, "filename", JS_NewString(ctx, basename(rpath)));
    JS_SetPropertyStr(ctx, process, "pid", JS_NewNumber(ctx, getpid()));
    JS_SetPropertyStr(ctx, global_obj, "process", process);

    // 执行脚本
    JSValue js_code = JS_Eval(ctx, (const void*)buf, buf_len, argv[2], JS_EVAL_TYPE_MODULE | JS_EVAL_FLAG_STRICT);
    if (JS_IsException(js_code)) {
        fputs("Failed to parse script\n", stderr);
        js_std_dump_error(ctx);
        JS_FreeValue(ctx, js_code);
        exit_code = 2;
        goto fail;
    }
    JS_FreeValue(ctx, js_code);
    free(buf);

    // 根据命令行参数监听不同的地址
    if(strlen(argv[1]) < 4){
        printf("Invalid address format. Use 'uds:path' or 'tcp:port'.\n");
        exit(1);
    }
    const char *protocol = argv[1],
        *addr = argv[1]+4;
    argv[1][3] = '\0';

    if(strcmp(protocol, "uds") == 0){
        listen_unix(addr);
    } else if(strcmp(protocol, "tcp") == 0){
        listen_tcp(addr);
    } else{
        printf("Unknown protocol. Use 'uds:path' or 'tcp:port'.\n");
        printf("protocol: %s\n", protocol);
        exit(1);
    }

fail:
    // 清理环境
    JS_FreeValue(ctx, global_obj);
    JS_FreeContext(ctx);
    JS_FreeRuntime(rt);

    return exit_code;
}
