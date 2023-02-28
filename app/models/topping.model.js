
const mongoose = require('mongoose')
const Schema = mongoose.Schema

const ToppingSchema = new Schema({
  name: {
    type: String,
    required: [true, 'Topping must have name'],
    trim: true,
    unique: true,
  },
  type: {
    type: String,
    required: [true, 'Topping must have type'],
    trim: true,
  }
})

const Toppings = mongoose.model('Topping', ToppingSchema)

module.exports = Toppings;