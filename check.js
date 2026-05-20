import puppeteer from 'puppeteer';
import express from 'express';
import path from 'path';

(async () => {
    const app = express();
    app.use(express.static('dist'));
    const server = app.listen(3002);

    const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
    
    await page.goto('http://localhost:3002', { waitUntil: 'networkidle0' });
    const html = await page.$eval('#root', el => el.innerHTML);
    console.log('ROOT HTML LENGTH:', html.length);
    console.log('ROOT HTML:', html);
    await browser.close();
    server.close();
})();
