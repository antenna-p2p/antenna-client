
# puppeteer-direct

puppeteer-direct is a small library that allows easy access to in-browser JS when using [puppeteer](https://github.com/GoogleChrome/puppeteer/).

## The problem it comes to solve
Puppeteer (headless-chrome for node.js) gives access to JS inside the browser, using [JSHandles](https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md#class-jshandle). However the code that runs them is a bit cumbersome, you keep have to separating between the node context and the browser context.

Code in puppeteer looks like this:
```js
     const text = await page.evaluate(id => window.document.querySelector(`#${id}`).innerText, id)
```

The node-side parameters have to be manually passed to the browser context.

Code with puppeteer-direct looks like this:
```js
     const text = await getWindowHandle(page).document.querySelector(`#${id}`).innerText
```

## API
puppeteer-direct exposes two functions:
```js
     directJSHandle(Puppeteer.JSHandle | Promise<Puppeteer.JSHandle]>): PuppeteerDirectHandle
```
This function wraps a puppeteer JSHandle, with a proxy that works with direct JS access.

```js
     getWindowHandle(Puppeteer.Page): PuppeteerDirectHandle
```
getWindowHandle wraps the window handle for a specific page.
