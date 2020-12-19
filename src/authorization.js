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

async function savePasswordForUser(user, password) {
    await keytar.setPassword('OrderingStack', user, password);
}

async function getPassword(user) {
    const password = await keytar.getPassword('OrderingStack', user);
    return password;
}

async function checkAndOptionallyAskForCredentials(userName, _accessTokenProviderCallbackAsync) {
    let token = null;
    do {
        console.log(`Authorization with user: ${userName}...`);
        const accessToken = await _accessTokenProviderCallbackAsync();
        if (!accessToken) {
            console.log('Authorization failed.');
            const r = await inquirer.prompt([
                {
                    type: 'password',
                    name: 'secret',
                    message: `Enter password for [${userName}]:`,
                },
            ]);
            savePasswordForUser(userName, r.secret);
        } else {
            token = accessToken;
            console.log('Auth OK');            
        }
    } while (!token);
    return token;
}


module.exports = {
    authorize, savePasswordForUser, checkAndOptionallyAskForCredentials
}