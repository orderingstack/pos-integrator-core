const axios = require('axios');
const keytar = require('keytar');
const inquirer = require('inquirer');

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
            data: `username=${username}&password=${password}&grant_type=password&scope=read`,
        });
        return {
            authData: response.data,
            err: null
        }
    } catch (error) {
        console.error('Authorization error');
        //console.error(error)
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

async function checkAndOptionallyAskForCredentials(userName, _authDataProviderCallbackAsync) {
    let token = null;
    do {
        console.log(`Authorization with user: ${userName}...`);
        const authResult = await _authDataProviderCallbackAsync();
        const access_token = (authResult)?authResult.access_token:null;
        if (!access_token) {
            console.log('Authorization failed.');
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
            token = access_token;
            console.log('Auth OK');            
        }
    } while (!token);
    return token;
}


module.exports = {
    authorize, savePasswordForUser, checkAndOptionallyAskForCredentials, setInternalCredentials
}