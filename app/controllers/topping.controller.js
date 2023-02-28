const mongoose = require('mongoose')
const fs = require('fs')
const mongoURI = require('../config/db.config').url;
const Toppings = require('../models/topping.model');



exports.importData = () => {

  // import data to MongoDB
  const importJSON = async () => {
    const data = JSON.parse(fs.readFileSync(process.env.FILEPATH, 'utf-8'))

    console.log(data)

    try {
      await Toppings.create(data)
      console.log('data successfully imported')
      // to exit the process
      process.exit()
    } catch (error) {
      console.log('error', error)
    }
  }


  mongoose.connect(mongoURI).then(() => {
    console.log('db connected');
    importJSON();
  });
};