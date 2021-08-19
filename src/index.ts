import 'dotenv/config';
import cron from 'node-cron';
import querystring from 'querystring';
import { telcel, telegram } from './axios';
import { infoLog, errorLog, debugLog } from './debug';
import Sentry from './sentry';

// Notify each MB_NOTIFY
const MB_NOTIFY: number = 100;
interface DataPlanHistory {
  [key: string]: {
    prevMbUsados?: number;
    nextCheckPoint?: number;
  };
}

const history: DataPlanHistory = {};
let doLoginNextRun: boolean = true;

async function validateCookie() {
  const checkCookie = await telcel.get('https://wbl.telcel-id.com:8443/valida-cookie');
  return (
    checkCookie.status === 200 &&
    checkCookie.data?.descripcion === 'Cookie valida' &&
    checkCookie.data?.estatus === 'ok'
  );
}

async function getToken() {
  const loginPayload = {
    username: process.env.USERNAME,
    password: process.env.PASSWORD,
    sitedomain: 'https://www.mitelcel.com/mitelcel',
    CCode: 52,
  };

  const fetchToken = await telcel.get('https://wbl.telcel-id.com:8443/Auth', {
    params: {
      ...loginPayload,
    },
  });

  return fetchToken?.data?.token;
}

async function doLogin() {
  infoLog('Trying to log in...');
  const accessToken = await getToken();
  const authPayload = querystring.stringify({
    isTablet: 'false',
    j_username: accessToken,
    j_password: '',
    goto: 'opcional',
    fromTelcel: '',
    origen: 'ssoWeblogin',
  });

  const doAuth = await telcel.post('https://www.mitelcel.com/mitelcel/login/auth', authPayload);
  const validNewCookie = await validateCookie();
  if (validNewCookie) {
    infoLog('Login successful...');
    doLoginNextRun = false;
  } else {
    Sentry.captureException(new Error('Login failed'));
    errorLog('Login failed...');
  }
}

function sendNotification(text: string) {
  if (!text) return;
  telegram.post('sendMessage', { chat_id: process.env.CHAT_ID, text: text });
}

async function main(forceNotification: boolean = false) {
  try {
    if (doLoginNextRun) {
      await doLogin();
    }
    const apiResponse = await telcel.get(
      `https://www.mitelcel.com/mitelcel/mitelcel-api-web/api/postpago/internet/consumo/${
        process.env.USERNAME
      }?_=${Date.now()}`
    );
    const isJsonResponse = apiResponse.headers['content-type'].startsWith('application/json');

    if (isJsonResponse) {
      const dataPlans = apiResponse.data.response?.data?.consumos || [];

      for (const dataPlan of dataPlans) {
        if (!history[dataPlan.clave]) {
          history[dataPlan.clave] = {};
        }

        debugLog(dataPlan.clave, 'MB usados:', dataPlan.mbUsados);

        let notificationText: string = '';
        const prevMbUsados = history[dataPlan.clave].prevMbUsados || 0;
        const nextCheckPoint = history[dataPlan.clave].nextCheckPoint || 0;

        if (dataPlan.mbUsados < prevMbUsados) {
          debugLog('New data plan');
          history[dataPlan.clave].nextCheckPoint = Math.ceil(dataPlan.mbUsados / MB_NOTIFY) * MB_NOTIFY;
          notificationText = `📈 Nuevo paquete de datos! \n⬆️ ${dataPlan.mbDisponibles} MB disponibles`;
        } else if (forceNotification || dataPlan.mbUsados > nextCheckPoint) {
          debugLog('New data update');
          if (!forceNotification) {
            history[dataPlan.clave].nextCheckPoint = Math.ceil(dataPlan.mbUsados / MB_NOTIFY) * MB_NOTIFY;
          }
          notificationText = `⬇️ ${dataPlan.mbUsados} MB usados (${dataPlan.porcentajeConsumido}%)`;
        }

        if (notificationText) {
          debugLog(notificationText);
          sendNotification(notificationText);
          notificationText = '';
        }

        // Save history
        history[dataPlan.clave].prevMbUsados = dataPlan.mbUsados;
      }
    } else {
      throw new Error('Invalid response. Response type: ' + apiResponse.headers['content-type']);
    }
  } catch (error) {
    Sentry.captureException(error);
    errorLog(error.message);
    doLoginNextRun = true;
  }
}

// Every minute
cron.schedule('* * * * *', () => {
  main();
});

// Every day at 7:01 AM
cron.schedule('1 7 * * *', () => {
  main(true);
});
