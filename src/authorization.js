const axios = require('axios');
const keytar = require('keytar');
const inquirer = require('inquirer');
const {logger} = require('./logger');

const authorize = async (baseUrl, tenant, basicAuthPass, username) => {
    const password = await getPassword(username);
    let response = null;
    try {
        response = await axios({
            method: 'post',
            url: `${baseUrl}/auth-oauth2/oauth/token`,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
                'Authorization': `Basic ${basicAuthPass}`,
                'X-Tenant': tenant
            },
            data: `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&grant_type=password&scope=read`,
        });
        return {
            authData: response.data,
            err: null
        }
    } catch (error) {
        const errorMessage = (error.response && error.response.data)?error.response.data.error_description:"unknown error";        
        logger.error(`Authorization error: ${errorMessage}`);
        //logger.error(error.response)
        return {
            authData: {},
            err: error.response ? error.response.status : error,
            errMsg: error.response ? (error.response.statusText + ' ' + error.response.status) : ''
        }
    }
}

let _internalCredentials = { user: null, password: null};
function setInternalCredentials(user, password) {
    _internalCredentials = {
        user, 
        password
    };
}

async function savePasswordForUser(user, password) {
    await keytar.setPassword('OrderingStack', user, password);
}

async function getPassword(user) {
    if (_internalCredentials.user === user) {
        return _internalCredentials.password;
    }
    const password = await keytar.getPassword('OrderingStack', user);
    return password;
}

/*async function getInfoAboutLoggedUser(baseUrl, tenant, accessToken) => {
    const    response = await axios({
            method: 'get',
            url: `${baseUrl}/auth-api/api/me`,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
            }
        });
        return response.data,
} */

async function checkAndOptionallyAskForCredentials(userName, _authDataProviderCallbackAsync) {
    let token = null;
    do {
        logger.info(`Authorization with user: ${userName}...`);
        const authResult = await _authDataProviderCallbackAsync();
        const access_token = (authResult)?authResult.access_token:null;
        if (!access_token) {
            logger.warn('Authorization failed.');
            const r = await inquirer.prompt([
                {
                    type: 'password',
                    name: 'secret',
                    message: `Enter password for [${userName}]:`,
                },
            ]);
            if (r.secret) {
                savePasswordForUser(userName, r.secret);
            }
        } else {
            //getInfoAboutLoggedUser()
            token = access_token;
            logger.info('Auth OK');            
        }
    } while (!token);
    return token;
}


module.exports = {
    authorize, savePasswordForUser, checkAndOptionallyAskForCredentials, setInternalCredentials
}