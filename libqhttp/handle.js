export function handle(/** @type { import('./object').default } */res) {
    res.status(200);
    res.send(res.method);
}