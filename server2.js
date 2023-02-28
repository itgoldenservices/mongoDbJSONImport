const { MongoClient, ServerApiVersion } = require('mongodb');
const fs = require('fs');
const uri = process.env.URI;

console.log(`trying to connect ${uri}`);

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
async function run() {
    try {
        console.log(`Connected ${uri}`);
        const collection = client.db(process.env.DB).collection(process.env.COLLECTION);
        const data = fs.readFileSync(process.env.FILEPATH);
        const res = await collection.insertMany(JSON.parse(data));
        console.log(res);
        console.log(`documents inserted`);

    } finally {
        // Ensures that the client will close when you finish/error
        await client.close();
    }
}
run().catch(console.dir);