/*import 'expect-puppeteer';
import 'path';

const
    //TODO: Switch back to this when <script type="module"> is supported https://github.com/jsdom/jsdom/issues/2475
    //{ JSDOM } = require("jsdom"),
    projectRoot = path.resolve(__dirname, ".."),;*/



const
    { getWindowHandle } = require("./puppeteer-direct"),
    pti = require('puppeteer-to-istanbul'),
    url = "http://localhost:3000";
let window, client;

function locationString({ url, lineNumber: line, columnNumber: col }) {
    return `${url}${line ? ":" + line : ""}${col ? ":" + col : ""}`;
}

function stackString(stack) {
    return stack.map(locationString).join("\n  > at ");
}


function handleLog(logObj) {
    let
        type = logObj.type(),
        stackList = logObj.stackTrace();


    console[type](`[Web Client] (${type}) web@${locationString(stackList[0])} ${logObj.text()}${type != "log" ? "\n" + stackString(stackList) : ""}`);
}

page.on("console", handleLog);
describe('index.html', () => {
    beforeAll(async done => {
        await page.goto(url + "/index.html");
        //getWindowHandle(page).onload = done;

        await Promise.all([
            page.coverage.startJSCoverage(),
            page.coverage.startCSSCoverage()
        ]);
        setTimeout(done, 3000);
    });

    afterAll(async () => {
        const [jsCoverage, cssCoverage] = await Promise.all([
            page.coverage.stopJSCoverage(),
            page.coverage.stopCSSCoverage(),
        ]);
        pti.write([...jsCoverage, ...cssCoverage], { includeHostname: false, storagePath: './.nyc_output' });
    });
    test("joining room", async () => {
        await page.evaluate(async () => {
            await client.joinRoom("travis");
            console.log(client.room.roomId);
        });

    });
});
;
