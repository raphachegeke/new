const express = require('express');
//const https = require('https');
//const http = require('http');
//const fs = require('fs');
const path = require('path');

// Add fetch polyfill for older Node.js versions
const fetch = require('node-fetch');
global.fetch = fetch;

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

require('dotenv').config();
const app = express();
const cors = require('cors');
const port = 8080;
const websiteName = 'domain.com'; /// add your domain like this format domain.com
const mpesaRoutes = require('./routes/mpesa');
app.use('/api', mpesaRoutes);

app.use(express.json());
app.use(
    express.urlencoded({
        extended: true,
    })
);

app.use(cors({
  origin: '*', // allow all origins
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization']
}));


const stripe = require('stripe')(process.env.STRIPE_SECRET);
app.post('/api/pay', async (req, res) => {
    var price = req.body.price;
    price = parseInt(price) * 100;
    const paymentIntent = await stripe.paymentIntents.create({
        amount: price,
        currency: 'usd',
        // Verify your integration in this guide by including this parameter
        metadata: { integration_check: 'accept_a_payment' },
    });
    res.json({ client_secret: paymentIntent['client_secret'], server_time: Date.now() });
});
app.post('/api/check', async (req, res) => {
    const accountType = req.body.accountType;
    const expDate = req.body.expDate;
    var specific_date = new Date(expDate);
    var current_date = new Date();
    /// We need to get account membership type - expiration. and check if the user can download the resume
    if (current_date.getTime() < specific_date.getTime()) {
        res.json({ status: 'true' });
    } else {
        res.json({ status: 'false' });
    }
});

app.post('/api/date', async (req, res) => {
    var current_date = new Date();
    res.json({ date: current_date });
});

app.get('/api/resume', async (req, res) => {});
///
app.post('/api/export', async (req, res) => {
    try {
        (async () => {
            const browser = await puppeteer.launch({
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox'],

                        executablePath: '/snap/bin/chromium'
            });
            const page = await browser.newPage();
            console.log('navigating to :  ');
            console.log('http://' + websiteName + '/export/' + req.body.resumeName + '/' + req.body.resumeId + '/' + req.body.language);
            await page.goto('http://' + websiteName + '/export/' + req.body.resumeName + '/' + req.body.resumeId + '/' + req.body.language, {
                timeout: 60000,
            });
            await page.waitForSelector('#resumen', {
                visible: true,
            });
            await page.waitFor(3000);

            var pdf = await page.pdf({ path: 'hn.pdf', format: 'a4' });
            await browser.close();

            res.download('./hn.pdf');
        })();
    } catch (error) {}
});

// Import AI routes
//const aiRoutes = require('./routes/ai');

// Use AI routes
//app.use('/api', aiRoutes);

/// Just to check if api is working
app.get('/api/return', async (req, res) => {
    res.end('Hello World\n');
});

//changed here
const PORT = process.env.PORT || 8080;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});


app.get('/api/linkedin-scraper', async (req, res) => {
    try {
        const cookiesPath = path.join(__dirname, 'cookies.json');
        const cookiesExist = fs.existsSync(cookiesPath);
        const cookies = cookiesExist ? JSON.parse(fs.readFileSync(cookiesPath, 'utf8')) : [];

        const browser = await puppeteer.launch({
            headless: false,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        });

        const page = await browser.newPage();

        // Set user agent
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

        // Set cookies before navigating
        if (cookies.length > 0) {
            await page.setCookie(...cookies);
            console.log('Cookies loaded into page');
        }

        console.log('navigating to LinkedIn jobs search...');

        await page.goto('https://www.linkedin.com/jobs/search?keywords=web%20developer&location=United%20States&geoId=103644278&trk=public_jobs_jobs-search-bar_search-submit&position=1&pageNum=0', {
            timeout: 60000,
            waitUntil: 'networkidle0',
        });

        await page.waitForSelector('ul.jobs-search__results-list', {
            visible: true,
            timeout: 30000,
        });

        await page.waitForTimeout(3000); // fixed deprecated waitFor

        const jobData = await page.evaluate(() => {
            const jobCards = document.querySelectorAll('ul.jobs-search__results-list div.base-card');
            const jobs = [];

            jobCards.forEach((card, index) => {
                const textContent = card.textContent.trim();
                if (textContent) {
                    jobs.push({
                        id: index + 1,
                        content: textContent,
                    });
                }
            });

            return jobs;
        });

        await browser.close();

        res.json({
            success: true,
            totalJobs: jobData.length,
            jobs: jobData,
        });
    } catch (error) {
        console.error('LinkedIn scraper error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to scrape LinkedIn jobs',
            message: error.message,
        });
    }
});
