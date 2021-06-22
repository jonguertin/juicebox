const { Client } = require("pg");
const client = new Client("postgres://localhost:5432/juicebox-dev");

//HELPER FUNCTIONS

function generateInsertValues(valueList) {
  return valueList.map((_, index) => `$${index + 1}`).join("), (");
}

function generateSelectValues(valueList) {
  return valueList.map((_, index) => `$${index + 1}`).join(", ");
}

//USER METHODS

//Create Users
async function createUser({ username, password, name, location }) {
  try {
    const {
      rows: [user],
    } = await client.query(
      `
            INSERT INTO users (username, password, name, location ) 
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (username) DO NOTHING
            RETURNING *;
        `,
      [username, password, name, location]
    );
    return user;
  } catch (error) {
    console.log(`Error creating user: ${username}`);
    throw Error;
  }
}

//Update Users
async function updateUser(id, fields = {}) {
  const setString = Object.keys(fields)
    .map((key, index) => `"${key}"=$${index + 1}`)
    .join(", ");

  if (setString.length === 0) {
    return;
  }

  try {
    const {
      rows: [user],
    } = await client.query(
      `
  UPDATE users
  SET ${setString}
  WHERE id = ${id}
  RETURNING *
  `,
      Object.values(fields)
    );
    return user;
  } catch (error) {}
}

//Get All Users
async function getAllUsers() {
  const { rows } = await client.query(
    `SELECT id, username, name, location, active
        FROM users;`
  );

  return rows;
}

//Get User by ID
async function getUserById(userId) {
  const {
    rows: [user],
  } = await client.query(
    `SELECT id, username, name, location, active
        FROM users
        WHERE id = ${userId};`
  );

  if (!user) {
    return null;
  }

  user.posts = await getPostsByUser(userId);

  return user;
}

//POST METHODS

//Create Post
async function createPost({ authorId, title, content, tags = [] }) {
  console.log("Create post items:", authorId, title, content, tags);
  try {
    const {
      rows: [post],
    } = await client.query(
      `
    INSERT INTO posts ("authorId", title, content)
    VALUES ($1, $2, $3)
    RETURNING *;
    `,
      [authorId, title, content]
    );
    console.log("before create tags is run", tags);
    const tagList = await createTags(tags);
    console.log("tagList", tagList);
    // return await addTagsToPost(post.id, tagList);
  } catch (error) {
    console.log(`Error creating post!`);
    throw error;
  }
}

//Update Post
async function updatePost(postId, fields = {}) {
  const { tags } = fields;
  console.log(tags);
  delete fields.tags;

  const setString = Object.keys(fields)
    .map((key, index) => `"${key}"=$${index + 1}`)
    .join(", ");

  try {
    if (setString.length > 0) {
      await client.query(
        `
        UPDATE posts
        SET ${setString}
        WHERE id = ${postId}
        RETURNING *
      `,
        Object.values(fields)
      );
    }

    if (tags === undefined) {
      return await getPostById(postId);
    }

    const tagList = await createTags(tags);

    const tagListIdString = tagList.map((tag) => `${tag.id}`).join(", ");

    await client.query(
      `
      DELETE FROM post_tags
      where "tagId"
      NOT IN (${tagListIdString})
        AND "postId" =$1
    `,
      [postId]
    );

    await addTagsToPost(postId, tagList);

    return await getPostById(postId);
  } catch (error) {
    console.log(`Error updating post ID: ${postId}`);
    throw error;
  }
}

//Get All Posts
async function getAllPosts() {
  try {
    const { rows: postIds } = await client.query(
      `SELECT id
          FROM posts;`
    );

    const posts = await Promise.all(
      postIds.map((post) => getPostById(post.id))
    );

    return posts;
  } catch (error) {
    console.log(`Error returning all posts.`);
    throw error;
  }
}

//Get Post By UserID
async function getPostsByUser(userId) {
  try {
    const { rows: postIds } = await client.query(
      `SELECT id
      FROM posts
      WHERE "authorId" = ${userId};
      `
    );

    const posts = await Promise.all(
      postIds.map((post) => getPostById(post.id))
    );

    return posts;
  } catch (error) {
    console.log("Error getting posts for user.");
    throw error;
  }
}

//Get Posts by ID
async function getPostById(postId) {
  const {
    rows: [post],
  } = await client.query(
    `SELECT *
        FROM posts
        WHERE id = $1`,
    [postId]
  );

  const { rows: tags } = await client.query(
    `SELECT tags.*
      FROM tags
      JOIN post_tags ON tags.id=post_tags."tagId"
      WHERE post_tags."postId" = $1;`,
    [postId]
  );

  const {
    rows: [author],
  } = await client.query(
    `
    SELECT id, username, name, location
    FROM users
  where id=$1;`,
    [post.authorId]
  );

  post.tags = tags;
  post.author = author;

  delete post.authorId;

  return post;
}

async function getPostsByTagName(tagName) {
  try {
    const { rows: postIds } = await client.query(
      `
      SELECT posts.id
      FROM posts
      JOIN post_tags ON posts.id = post_tags."postId"
      JOIN tags ON tags.id = post_tags."tagId"
      where tags.name = $1
    `,
      [tagName]
    );

    return await Promise.all(postIds.map((post) => getPostById(post.id)));
  } catch (error) {
    throw error;
  }
}

//TAG METHODS

//Create Tags
async function createTags(tagList) {
  if (tagList.length === 0) {
    return;
  }
  console.log("before createTags runs", tagList);
  try {
    const insertValues = tagList
      .map((_, index) => `$${index + 1}`)
      .join("), (");

    const selectValues = tagList.map((_, index) => `$${index + 1}`).join(", ");

    console.log(Object.values(tagList));

    console.log(`INSERT INTO tags(name)
    VALUES (${insertValues})
    ON CONFLICT (name) DO NOTHING;`);

    await client.query(
      `INSERT INTO tags(name)
      VALUES (${insertValues})
      ON CONFLICT (name) DO NOTHING;`,
      Object.values(tagList)
    );

    const { rows: tags } = await client.query(
      `SELECT *
      FROM tags
      WHERE name IN (${selectValues})`,
      Object.values(tagList)
    );

    return tags;
  } catch (error) {
    throw error;
  }
}

//Create Post Tag
async function createPostTag(postId, tagId) {
  try {
    await client.query(
      `
    INSERT INTO post_tags("postId", "tagId")
    VALUES ($1, $2)
    ON CONFLICT ("postId", "tagId") DO NOTHING;
    `,
      [postId, tagId]
    );
  } catch (error) {
    throw error;
  }
}

//Get all tags
async function getAllTags() {
  try {
    const { rows: tags } = await client.query(
      `SELECT *
          FROM tags;`
    );

    return tags;
  } catch (error) {
    console.log(error);
    throw error;
  }
}

//Add Tags to Post
async function addTagsToPost(postId, tagList) {
  console.log("add tags to post", postId, tagList);
  try {
    if (tagList.length > 0) {
      const createPostTagPromises = tagList.map((tag) =>
        createPostTag(postId, tag.id)
      );

      console.log(createPostTagPromises);

      await Promise.all(createPostTagPromises);
      return await getPostById(postId);
    }
  } catch (error) {
    throw error;
  }
}

module.exports = {
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
  getAllTags,
  createTags,
  addTagsToPost,
};
