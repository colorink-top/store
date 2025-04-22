#!/bin/bash
. ~/.nvm/nvm.sh
nvm use 18.16.0
pm2 delete jopp-stores-2022-server
pm2 start http-server --name "jopp-stores-2022-server" -- -p 2022 -c600 src

#cd src
#http-server -p 2022 -c600
