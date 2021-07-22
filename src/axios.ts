import axios from 'axios';
import https from 'https';
import axiosCookieJarSupport from 'axios-cookiejar-support';

const telcel = axios.create({
  withCredentials: true,
  timeout: 60000,
  httpsAgent: new https.Agent({ keepAlive: true }),
  headers: {
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.122 Safari/537.36',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'Expires': '0',
  },
});

const telegram = axios.create({
  baseURL: `https://api.telegram.org/bot${process.env.BOT_TOKEN}/`
});

axiosCookieJarSupport(telcel);
telcel.defaults.jar = true;

export { telcel, telegram };
