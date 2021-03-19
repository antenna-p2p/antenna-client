module.exports = {
    launch: {
        args: [
            '--disable-web-security',
        ]
    },
    server: {
        command: `npm --prefix ${__dirname} run test:server`,
        port: "3000",
        debug: true
    }
}