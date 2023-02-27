module.exports = app => {
  const posts = require("../controllers/post.controller.js");

  var router = require("express").Router();

  // Create a new Post
  router.post("/", posts.create);

  // Retrieve all Posts
  router.get("/", posts.findAll);

  // Retrieve all published Posts
  router.get("/published", posts.findAllPublished);

  // Retrieve a single Post with id
  router.get("/:id", posts.findOne);

  // Update a Post with id
  router.put("/:id", posts.update);

  // Delete a Post with id
  router.delete("/:id", posts.delete);

  // Create a new Post
  router.delete("/", posts.deleteAll);

  // Import file
  //router.put("/importJson", posts.importJson);

  app.use("/api/posts", router);
};
