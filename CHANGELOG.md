# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.0] - 2023-05-17

- feat: add checkSeq column

## [1.2.6] - 2022-11-09

- cancelOrder added reason parameter
- auto-create 'data' folder if does not exist

## [1.1.0] - 2022-07-17

- setLogger to inject logger
- updated dependencies: better-sqlite3, axios, sockjs-client, keytar
- better logs in case of auth errors

## [1.0.8] - 2022-03-15

- fix for generating stats for empty db

## [1.0.7] - 2022-02-17

- BREAKING CHANGES OF API
- new control flow of order processing based on stages.

## [0.6.0] - 2022-01-24

- new feature: orderService.cancelOrder added

## [0.5.0] - 2022-01-22

- new feature: orderService.postOrderPayment added
- updated npm dependencies to resolve vuneralibilties issues: jest, axios, sockjs-client, inquirer

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
