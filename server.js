const express = require('express')
const cors = require('cors')
const app = express()

app.use(express.json())
app.use(cors())
const {AutoExemptionService}  = require('./app/controllers/AutoExemptionService');
// connect to mongodb

app.get('/', (req, res) => {
  res.send({
    title: 'hello world',
  })
})


const PORT = process.env.PORT || 8091 

app.listen(PORT, () => { console.log(`listening to port ${PORT}`);  new AutoExemptionService().checkExam('/netapp/netappDir/educator/arobinson143/2489/master/cathy33/exam', 'ASSESSMENT_RESET'); })