
const mongoose = require('mongoose')
const Schema = mongoose.Schema

const PostSchema = new Schema({
  item: {
    type: String,
    required: [true, 'Post must have item'],
    trim: true,
    unique: true,
  },
  date: {
    type: String,
    required: [true, 'Post must have date'],
    trim: true,
  },
  quantity: {
    type: Number,
    required: [true, 'quantity is required'],
  },
  price: {
    type: Number,
    required: [true, 'price is required'],
  },
})

const Posts = mongoose.model('Post', PostSchema)

module.exports = Posts;