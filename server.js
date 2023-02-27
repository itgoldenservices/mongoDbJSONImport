const express = require('express')
const cors = require('cors')
const app = express()
const importData = require('./app/controllers/post.controller').importData;
app.use(express.json())
app.use(cors())

// connect to mongodb

app.get('/', (req, res) => {
  res.send({
    title: 'hello world',
  })
})


const PORT = process.env.PORT || 8080

app.listen(PORT, () => { console.log(`listening to port ${PORT}`); importData(); })