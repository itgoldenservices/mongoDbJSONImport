mongoimport --uri 'mongodb+srv://itgoldenservices:admin123@cluster0.6egp618.mongodb.net/blog?retryWrites=true&w=majority' \
   --username='itgoldenservices' \
   --password='admin123' \
  '--collection'='posts'  \
  '--file'='./app/json/posts.json' \
  '--jsonArray' 
mongoimport --uri 'mongodb+srv://itgoldenservices:admin123@cluster0.6egp618.mongodb.net/blog?retryWrites=true&w=majority' \
   --username='itgoldenservices' \
   --password='admin123' \
  '--collection'='toppings'  \
  '--file'='./app/json/toppings.json' \
  '--jsonArray'
 