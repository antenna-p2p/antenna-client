/*import 'expect-puppeteer';
import 'path';

const
    //TODO: Switch back to this when <script type="module"> is supported https://github.com/jsdom/jsdom/issues/2475
    //{ JSDOM } = require("jsdom"),
    projectRoot = path.resolve(__dirname, ".."),;*/

const
    { getWindowHandle } = require("./puppeteer-direct");
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

describe('index.html', () => {
    beforeAll(async () => {
        page.on("console", handleLog);
        await page.goto(url + "/index.html");
        window = getWindowHandle(page);
        client = window.client;
    });
    test("join room", async done => {
        client.joinRoom("");
    });
});
;
