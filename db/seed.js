const {
  client,
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  getAllPosts,
  getPostById,
  getPostsByUser,
  getPostsByTagName,
  createPost,
  updatePost,
  createTags,
  addTagsToPost,
} = require("./index");

async function dropTables() {
  try {
    console.log("Starting to drop tables...");

    await client.query(`
          DROP TABLE IF EXISTS post_tags;
          DROP TABLE IF EXISTS tags;
          DROP TABLE IF EXISTS posts;
          DROP TABLE IF EXISTS users;
      `);

    console.log("Finished dropping tables!");
  } catch (error) {
    console.error("Error dropping tables!");
    throw error;
  }
}

async function createTables() {
  try {
    console.log("Starting to build tables...");
    await client.query(`
      CREATE TABLE users (
          id SERIAL PRIMARY KEY,
          username varchar(255) UNIQUE NOT NULL,
          password varchar(255) NOT NULL,
          name varchar(255) NOT NULL,
          location VARCHAR(255) NOT NULL,
          active BOOLEAN DEFAULT true
        );
      `);
    await client.query(`
      CREATE TABLE posts (
          id SERIAL PRIMARY KEY,
          "authorId" INTEGER REFERENCES users(id) NOT NULL,
          title VARCHAR(255) NOT NULL,
          content TEXT NOT NULL,
          active BOOLEAN DEFAULT true
        );
      `);
    await client.query(`
      CREATE TABLE tags (
          id SERIAL PRIMARY KEY,
          name varchar(255) UNIQUE NOT NULL
        );
      `);
    await client.query(`
      CREATE TABLE post_tags (
          "postId" INT REFERENCES posts(id),
          "tagId" INT REFERENCES tags(id),
          UNIQUE ("postId", "tagId")
        );
      `);
    console.log("Finished building tables!");
  } catch (error) {
    console.error("Error building tables!");
    throw error;
  }
}

async function createInitialUsers() {
  try {
    console.log("Starting to create initial users...");

    await createUser({
      username: "albert",
      password: "bertie99",
      name: "Albert VanSlingshot",
      location: "Memphis, TN",
    });

    await createUser({
      username: "sandra",
      password: "sandie99",
      name: "Sandra Carini",
      location: "Jersey City, NJ",
    });

    await createUser({
      username: "glamgal",
      password: "glamit99",
      name: "Simone Walker",
      location: "New York, NY",
    });

    console.log("Finished creating initial users...");
  } catch (error) {
    console.error("Error creating initial users!");
    console.log(error);
    throw error;
  }
}

async function createInitialPosts() {
  try {
    const [albert, sandra, glamgal] = await getAllUsers();

    console.log("Starting to create posts...");
    console.log("Starting to create Albert");
    await createPost({
      authorId: albert.id,
      title: "First Post",
      content:
        "This is my first post. I hope I love writing blogs as much as I love writing them.",
    });
    console.log("Finished creating Albert.");

    await createPost({
      authorId: sandra.id,
      title: "Sandy's First Post",
      content:
        "This is my first post. I hope I love writing blogs as much as I love writing them.",
      tags: ["#happy", "#worstdayever"],
    });

    await createPost({
      authorId: glamgal.id,
      title: "Worst First Post",
      content: "This is my worst first post. I am emo.",
      tags: ["#happy", "#youcandoanything", "#catmandoanything"],
    });
    console.log("Finished creating posts!");
  } catch (error) {
    console.log("Error creating posts.");
    throw error;
  }
}

async function createInitialTags() {
  try {
    console.log("Starting to create tags...");

    const [happy, sad, inspo, catman] = await createTags([
      "#happy",
      "#worst-day-ever",
      "#youcandoanything",
      "#catmandoeverything",
    ]);

    const [postOne, postTwo, postThree] = await getAllPosts();

    await addTagsToPost(postOne.id, [happy, inspo]);
    await addTagsToPost(postTwo.id, [sad, inspo]);
    await addTagsToPost(postThree.id, [happy, catman, inspo]);

    console.log("Finished creating tags!");
  } catch (error) {
    throw error;
  }
}

async function rebuildDB() {
  try {
    client.connect();

    await dropTables();
    await createTables();
    await createInitialUsers();
    await createInitialPosts();
    await createInitialTags();
  } catch (error) {
    console.log("Error during rebuildDB.");
    throw error;
  }
}

async function testDB() {
  try {
    console.log("Starting to test database...");

    console.log("Calling all users...");
    const users = await getAllUsers();
    console.log("Result: ", users);
    console.log("Finished calling all users...");

    console.log("Calling updateUser on users[0]");
    const updateUserResult = await updateUser(users[0].id, {
      name: "Newname Sogood",
      location: "Lesterville, KY",
    });
    console.log("Result: ", updateUserResult);

    console.log("Calling getAllPosts");
    const posts = await getAllPosts();
    console.log("Result:", posts);

    console.log("Calling updatePost on posts[0]");
    const updatePostResult = await updatePost(posts[0].id, {
      title: "New Title",
      content: "Updated Content",
    });
    console.log("Result:", updatePostResult);

    console.log("Calling updatePost on posts[0], only updating tags");
    const updatePostTagsResult = await updatePost(posts[0].id, {
      tags: ["#youcandoanything", "#redfish", "#bluefish"],
    });
    console.log("Result: updatePostTagsResult");

    console.log("Calling getUserById with 1");
    const albert = await getUserById(1);
    console.log("Result:", albert);

    console.log("Calling getPostsByTagName with #happy");
    const postsWithHappy = await getPostsByTagName("#happy");
    console.log("Result:", postsWithHappy);
  } catch (error) {
    console.error("Error testing database!");
    console.error(error);
  }
}

rebuildDB()
  .then(testDB)
  .catch(console.error)
  .finally(() => client.end());
