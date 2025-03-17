#!/bin/bash
. ~/.nvm/nvm.sh
nvm use 18.16.0
cd src
http-server -p 2022 -c600
