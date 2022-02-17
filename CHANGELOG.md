# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2022-02-17
- BREAKING CHANGES OF API
- new control flow of order processing based on stages. 

## [0.6.0] - 2022-01-24
- new feature: orderService.cancelOrder added 

## [0.5.0] - 2022-01-22
- new feature: orderService.postOrderPayment added 
- updated npm dependencies to resolve vuneralibilties issues:  jest, axios, sockjs-client, inquirer

## [0.4.0] - 2021-12-27
- new feature: onSteeringCommandAsync added to connectWebSockets method

## [0.1.53] - 2021-07-02

- fix: removing old records from local sqlite db

## [0.1.54] - 2021-07-15

- allow to set user pass from env variable by setInternalCredentials function

## [0.3.0] - 2021-11-01

- fix: removing old records from local db
- new feature: new column orderStatus for storing order status
- removing CLOSED and ABANDONED orders in regular job
- not taking closed or abandoned order for local or central processing
