const mqtt = require('mqtt');
const fs = require('fs');

const instances = {};

const connect = (flow, details) => {
  return new Promise((resolve, reject) => {
    const { client: id, connection } = details;

    const connectionOpts = {
      host: connection.host,
      clientId: id,
      protocol: connection.protocol || 'mqtt'
    }; 

    if (connection.key) {connectionOpts.key = fs.readFileSync(connection.key);}
    if (connection.cert) {connectionOpts.cert = fs.readFileSync(connection.cert);}
    if (connection.ca) {connectionOpts.ca = fs.readFileSync(connection.ca);}
    
    const client = mqtt.connect(connectionOpts);

    client.on('connect', () => {
      resolve(client);
    });

    client.on('error', (err) => {
      console.log(`Error connecting to MQTT broker: ${err}`);
      reject(err);
    });

    return client;
  });
};

const start = (flow, details) => {
  const {
    client: id
  } = details;

  if (instances[id]) {
    return instances[id];
  }

  return connect(flow, details)
    .then(client => {
      instances[id] = {
        client,
        messages: []
      };
    })

    // Handle message reception
    .then(() => {
      instances[id].client.on('message', (topic, message) => {
        const jsonMessage = JSON.parse(message.toString());
        instances[id].messages.push({
          topic,
          message: jsonMessage,
          date: new Date()
        });
      });
    })

    // Handle subscriptions
    .then(() => {
      const { subscribe } = details;
      if (subscribe) {
        const subscriptions = Array.isArray(subscribe) ? subscribe : [subscribe];
        const topics = subscriptions.map(sub => sub.topic);

        return Promise.all(topics.map(topic => {
          return new Promise((resolve, reject) => {
            instances[id].client.subscribe(topic, (err) => {
              if (err) {
                console.log(`Error subscribing to topic: ${err}`);
                reject(err);
                return;
              }
              resolve();
            });
          });
        }));
      }
    });
};

const stop = (id) => {
  if (instances[id] && instances[id].client) {
    instances[id].client.end();
    delete instances[id];
  }
};

const test = (flow, test, contents) => {
  return new Promise((resolve, reject) => {
    const { client: id, test: testMessages, retry } = test;

    // Verify client exists
    if (!instances[id]) {
      return reject(new Error(`MQTT client '${id}' does not exist or is not connected`));
    }
    
    const clientInstance = instances[id];
    const messages = clientInstance.messages;
    
    // Function to validate if all test messages have been received
    const validateMessages = () => {
      const results = {
        success: true,
        matched: [],
        notMatched: []
      };
      
      // Check each test message
      testMessages.forEach((testMsg) => {
        const { topic, message } = testMsg;
        
        // Find matching message in received messages
        const foundMessage = messages.find(m => 
          m.topic === topic && 
          Object.keys(message).every(key => m.message[key] === message[key])
        );
        
        if (foundMessage) {
          results.matched.push({
            topic,
            message,
            receivedAt: foundMessage.date
          });
        } else {
          results.notMatched.push({ topic, message });
          results.success = false;
        }
      });
      
      return results;
    };
    
    // Handle retries if specified
    let attempts = 0;
    const maxAttempts = retry?.attempts || 1;
    const delay = retry?.delay || 0;
    
    const attemptValidation = () => {
      attempts++;
      const results = validateMessages();
      
      if (results.success || attempts >= maxAttempts) {
        results.attempts = attempts;
        // resolve(results);
        resolve(results.notMatched);
      } else {
        setTimeout(attemptValidation, delay * 1000);
      }
    };
    
    // Start validation process
    attemptValidation();
  });
};

module.exports.start = start;
module.exports.stop = stop;
module.exports.test = test;