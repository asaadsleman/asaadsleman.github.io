const LEGACY_ID_PARAM = 'meduyeketLegacyId';
const DEVICE_ID_PARAM = 'deviceId';
const IS_LEGACY_DATA_TRANSFERRED = 'IslegacyMeduyeketDataTransferred';

const queryParams = new URLSearchParams(window.location.search);

const legacyId = getLegacyId();
let ssoId = getSsoId();
const deviceId = getDeviceId();
const anonymousId = getAnonymousId();

function checkIfLegacyGameFinished() {
  return queryParams.get('isFinished');
}
async function getMeduyeketHistory() {

  // UUID | null
  const legacyIdFromLocalStorage = localStorage.getItem(LEGACY_ID_PARAM);
  // UUID | null
  const mergedLegacyId = legacyId || legacyIdFromLocalStorage  ;

  // { 
  //   anonymousId: UUID,
  //   type: "meduyeketLegacy",
  //   results: {
  //    [key: number]: { successful: true, wordsAttempted: 1 | 2 | 3 | 4 | 5 | 6, },
  //   }
  // } | null
  const legacyData = !!mergedLegacyId && await getLegacyData(mergedLegacyId);
  // {
  //  [key: number]: { successful: true, wordsAttempted: 1 | 2 | 3 | 4 | 5 | 6, },
  // } | null
  const resultsFromLegacyData = (legacyData.status === 'success' && legacyData.legacyData) ? 
  legacyData?.legacyData?.[0]?.results : null;
  // {
  //   status: 'error' | 'success',
  //   data: Array<{ 
  //     anonymousId: UUID,
  //     ssoId: number | null,
  //     ssoId: number | null,
  //     type: "meduyeketHtz",
  //     results: {
  //      [key: number]: { successful: true, wordsAttempted: 1 | 2 | 3 | 4 | 5 | 6, },
  //     },
  //   }>
  // }
  const lastestData = await getDataFromMongo({ 
    ssoId, 
    deviceId, 
    anonymousId, 
    type: "MeduyeketHtz",
  });

  // Array<{ 
    //   anonymousId: UUID,
    //   ssoId: number | null,
    //   ssoId: number | null,
    //   type: "meduyeketHtz",
    //   results: {
      //    [key: number]: { successful: true, wordsAttempted: 1 | 2 | 3 | 4 | 5 | 6, },
      //   },
      // }>
  const resultsFromLastestData = (lastestData.status === 'success' && lastestData.data)
      ? await filterResults({ ssoId, deviceId, anonymousId, lastestData })
      : null;
      
  const combainedResultsLegacyAndLatest = combaineResults(resultsFromLegacyData, resultsFromLastestData);

  !isObjIsEmpty(combainedResultsLegacyAndLatest) && await postDataToMongo({ 
    ssoId, 
    deviceId, 
    anonymousId, 
    type: "MeduyeketHtz",
    results: combainedResultsLegacyAndLatest,
  });

  return combainedResultsLegacyAndLatest;
 
}

async function findAndMergeResultsWithSameSsoId(resultsById) {
  let sameSsoId = resultsById.map(res => { if (res.ssoId) return res.ssoId })?.[0]; 
  const newResultsSsoId = sameSsoId ? await getDataFromMongo({ ssoId: sameSsoId, type: "MeduyeketHtz"}): null;
  if (newResultsSsoId && (newResultsSsoId.status === 'success' && newResultsSsoId.data)) {
  let resultsSsoid = newResultsSsoId.data.map(res => res.results);
  let resultsId = resultsById.map(res => res.results);

  //change ssoId to new one for posting the data, i check it twice just in case
  ssoId = sameSsoId || null;
  results = combaineResults(resultsSsoid, resultsId);
    
  return  results;
  }
}

async function filterResults({ ssoId, deviceId, anonymousId, lastestData }) {
  const { data } = lastestData;

  if (ssoId) {
  let pretinentData = data.filter(result => !result.ssoId || result.ssoId === ssoId);
  let resultsToMerge = pretinentData.map(res => res.results);
  return combaineResults(resultsToMerge, []);
  } 
  
  if (deviceId) {
  //only results with the same device id 
  const resultsByDeviceId = data.filter(result => (result.deviceId === deviceId));
  
  //check if the results has the same ssoid
  const isSsoIdExistInResults = resultsByDeviceId.some((el) => el.ssoId);
  const isResultsWithSameSsoid = isSsoIdExistInResults && resultsByDeviceId.every(isSameSsoId);
  
  let results;
  //in case we all the result has the same ssoid pull the results for the same ssoid
  if (isResultsWithSameSsoid) {
   results = await findAndMergeResultsWithSameSsoId(resultsByDeviceId);
   return results

  } else {
    results = resultsByDeviceId.filter(res => !res.ssoId);
    let resultsToMerge = results.map(res => res.results);
    return combaineResults(resultsToMerge, []);
    } 
  }

  if (anonymousId) {
    //TODO: function that get id and combaine between the results 
    let resultsByAnonymousId = data.filter(result => result.anonymousId === anonymousId);

    
    //check if the results has the same ssoid
    const isSsoIdExistInResults = resultsByAnonymousId.some((el) => el.ssoId);
    const isResultsWithSameSsoid = isSsoIdExistInResults && resultsByAnonymousId.every(isSameSsoId);
    
    let results;
      //in case we all the result has the same ssoid pull the results for the same ssoid
  if (isResultsWithSameSsoid) {
    results = await findAndMergeResultsWithSameSsoId(resultsByAnonymousId);
     return results
  } else {
    results = resultsByAnonymousId.filter(res => !res.ssoId);
    let resultsToMerge = results.map(res => res.results);
    return combaineResults(resultsToMerge, []);
    } 
  }
  return null;
}

async function getDataFromMongo({ ssoId, deviceId, anonymousId, type }) {
  try {
    const dataResponse = await fetch(`https://services.haaretz.co.il/personalization/wordle/pull?anonymousId=${anonymousId || null}&deviceId=${deviceId || null}&ssoId=${ssoId || null}&type=${type}`)
    
    if (dataResponse.ok) {
      const data = await dataResponse.json();
      if (data && data != '{}') {
        return {
          status: 'success', 
          data,
        };
      }
    }

    const errorObject = {
      status: 'error', 
      code: data.status, 
      errorType: data.statusText, 
    };

    return errorObject;

  } 
  catch (err) {
    return { status: 'error', };
  }
}

async function getLegacyData(legacyId){
  try { 
    const legacyDataResponse = await fetch(`https://services.haaretz.co.il/personalization/wordle/pull?anonymousId=${legacyId}&type=MeduyeketLegacy`);
    if (legacyDataResponse.ok) {
      const legacyData = await legacyDataResponse.json();

      if (legacyData) {
        localStorage.removeItem(LEGACY_ID_PARAM);
        return {
          status: 'success',
          legacyData,
        };
      }
    }
    const errorObject = {
      status: 'error', 
      code: legacyDataResponse.status, 
      errorType: legacyDataResponse.statusText, 
    };
    // Write `legacyId` to localStorage so that we can recover it another time
    // get legacy data and merge it with mongo statistics 
    if (legacyId) localStorage.setItem(LEGACY_ID_PARAM, legacyId);
    return errorObject;
  }
  catch (err) {
    // Write `legacyId` to localStorage so that we can recover it another time
    // get legacy data and merge it with mongo statistics 
    if (legacyId) localStorage.setItem(LEGACY_ID_PARAM, legacyId);
    return { status: 'error', };
  }
}

async function postDataToMongo({ ssoId, deviceId , anonymousId, results, }) {

  if (!ssoId && !deviceId && !anonymousId && !results) return

  const data = {
    ssoId,
    deviceId,
    anonymousId, 
    type: "MeduyeketHtz",
    results,
  };

  const mongoResponse = await fetch("https://services.haaretz.co.il/personalization/wordle/write", {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  })


  if (mongoResponse.ok) {
    return { status: 'success', };
  } else {
    return { status: 'error', };
  }
}

async function getFormattedResults() {
  let results = [];
  const resultsToFormat = await getMeduyeketHistory();
  const resultsToFormatArr = Object.values(resultsToFormat) || [];

  resultsToFormatArr.map((res,i) => {
    results.push(res.successful ? res.wordsAttempted : 'X')
  })

  return results;
}

async function postFormattedResults(newResults) {
  //word id for result obj
  const dateForId = new Date().toLocaleDateString('he-IL', {timeZone: 'Asia/Jerusalem'});
  const todayWordId = getWordId(dateForId);
  let reversedNewResults = newResults.reverse();

  const results = {};
  reversedNewResults.map((result, i) => {
    let isSuccessful = !(result === 'X'); 
    let newWordId = todayWordId - i;
    if (!newWordId) return;
    results[newWordId] = { successful: isSuccessful, wordsAttempted: isSuccessful ? result : '6'};
  }) 

  await postDataToMongo({ ssoId, deviceId , anonymousId, results });
}

//get IDS
function getAnonymousId(){
  return getCookie('anonymousId') || generateAnonymousId();
}
 
function getDeviceId() {
  return queryParams.get(DEVICE_ID_PARAM)
    || localStorage.getItem(DEVICE_ID_PARAM)
    || undefined; 
}

function getSsoId() {
  let tmsso = getCookie('tmsso');
  let userId = searchInCookie('userId', tmsso)
  let ssoId = userId?.[1];
  return ssoId;
}

function getLegacyId() {
  let legacyIdFromParams = queryParams.get('legacyId');
  if (legacyIdFromParams) localStorage.setItem(LEGACY_ID_PARAM, legacyIdFromParams)
  return legacyIdFromParams || localStorage.getItem(LEGACY_ID_PARAM);
}

//UTILS
function getCookie(cookieName) {
  let name = cookieName + "=";
  let decodedCookie = decodeURIComponent(document.cookie);
  
  let cookie = decodedCookie.split(';');
  for(let i = 0; i <cookie.length; i++) {
    let c = cookie[i];
    while (c.charAt(0) == ' ') {
      c = c.substring(1);
    }
    if (c.indexOf(name) == 0) {
      return c.substring(name.length, c.length);
    }
  }
  return "";
}

function searchInCookie(name, cookie) {
  let result = cookie.split(':')
  .map(cookie => cookie.split('='))
  .filter(c => c.includes(name)).flat();

  return result;
}

function isSameSsoId(el, i, arr) {
    if (i === 0) {
      return true;
    } else {
      return (el.ssoId === arr[i - 1].ssoId || !el.ssoId);
    }
}

function isSsoIdExist(el) {
  el.includes('ssoId');
}

function generateAnonymousId() {
  // console.log(`getCookie - 'anonymousId' : ${getCookie('anonymousId')}`);
  const salt = getRandomInt(1000, 9999); // random between 1000 - 9999
  const now = Date.now();
  const expire = new Date(now + 7776000000); // 90 * 24 * 3600 * 1000 = 7776000000 = 90 days
  const anonymousId = `${now}${salt}`;
  const domain = 'haaretz.co.il';

  // Side effect: triggers a cookie reparsing
  setCookie('anonymousId', anonymousId, '/', domain, expire);
  return anonymousId;
}

function setCookie(
  key,
  value,
  path,
  domain,
  expiration = new Date(Date.now() + 31536000000) /* one year */
) {
  const params = [];
  const expires = expiration;
  params.push(`${key}=${encodeURIComponent(value)}`);

  if (path) {
    params.push(`path=${path}`);
  }
  if (domain) {
    params.push(`domain=${domain}`);
  }
  params.push(`expires=${expires.toUTCString()}`);

  document.cookie = params.join(';');
}

function combaineResults(resultsA, resultsB) {
  
  const resultsAArray = resultsA
    ? Array.isArray(resultsA) ? resultsA : [ resultsA, ]
    : [];
  const resultsBArray = resultsB
    ? Array.isArray(resultsB) ? resultsB : [ resultsB, ]
    : [];

  const mergedResultsA 
    = resultsAArray.reduce((merged, item) => ({ ...merged, ...item, }), {});
  const mergedResultsB
    = resultsBArray.reduce((merged, item) => ({ ...merged, ...item, }), {});
  
  const mergedObjects = { 
    ...mergedResultsA,
    ...mergedResultsB, 
  };


  return mergedObjects;
}

function getWordId(date) {
  const [day, month, year] = date.split('.').map(function(x) {return parseInt(x);});
  const start_ts = new Date(2022, 0, 1).getTime();
  const date_ts = new Date(year, month - 1, day).getTime();
  const wordId = Math.round((date_ts - start_ts) / 86400000);
  return wordId;
}

function getRandomInt(min, max) {
  return Math.floor(Math.random() * ((max - min) + 1)) + min;
}

function isObjIsEmpty(obj) {
  return Object.keys(obj).length === 0;
}