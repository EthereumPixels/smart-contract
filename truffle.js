module.exports = {
  networks: {
    "live": {
      network_id: 1,
    },
    "development": {
      host: "localhost",
      port: 8545,
      network_id: "*" // Match any network id
    },
    "rinkeby": {
      host: "localhost",
      port: 8545,
      network_id: 4,
      gas: 500000
    }
  }
};
