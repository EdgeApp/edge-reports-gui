# edge-reports-server

> Reporting tools and GUI for partner revenue share

## Installation

```sh
# Install Yarn

    https://linuxize.com/post/how-to-install-yarn-on-ubuntu-18-04/

# Install Node

    curl -sL https://deb.nodesource.com/setup_10.x -o nodesource_setup.sh
    sudo bash nodesource_setup.sh

# Run Yarn

    yarn

# Install CouchDB v3.1

    sudo apt-get install -y apt-transport-https gnupg ca-certificates
    echo "deb https://apache.bintray.com/couchdb-deb bionic main" \
    | sudo tee -a /etc/apt/sources.list.d/couchdb.list

    sudo apt-key adv --keyserver keyserver.ubuntu.com --recv-keys 8756C4F765C9AC3CB6B85D62379CE192D401AB61
    sudo apt update
    sudo apt-get install couchdb=3.1.0~bionic
    # install standalone
    # bind address = 127.0.0.1

    # Test that couch is running
    curl http://localhost:5984/
```

## Reporting Server

To launch the reports server, just type `yarn start`.

You can also build the server code by running `yarn build`, which puts its output in the `lib` folder. You can then use `PM2` or similar tools to install the software on your server machine.

```sh

#### Launch server using `PM2`

    pm2 start pm2.json

#### `PM2` Dashboard

    pm2 monit

#### Restart, stop, delete service

    Or run tasks manually,

    pm2 stop pm2.json
    
    pm2 restart pm2.json

    pm2 delete pm2.json
```

## Demo app

Run `yarn demo` to launch the demo app in your web browser.
