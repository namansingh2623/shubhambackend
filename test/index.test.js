const {describe,it} = require('mocha')
const Sequelize = require('sequelize');
const AWS = require('aws-sdk');


const fs = require('fs');

const s3=new AWS.S3({
    accessKeyId:process.env.S3_ACCESS_ID,
    secretAccessKey:process.env.S3_API_KEY
})

new Sequelize(process.env.MYSQL_DB_NAME, process.env.MYSQL_USERNAME, process.env.MYSQL_PASSWORD, {
    host: process.env.MYSQL_HOST_NAME,
    dialect: 'mysql',
    pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000
    },


});

const Album = require('../models/Album');
describe('S3 test',()=>{


    it('should upload photo', async () => {

        const albumId = 4;
        let album = await Album.findByPk(albumId)
        const file = require('../assets/rr.jfif')
        const params = {
            Bucket: 'bbpsipbucket/Gallery',
            Key: `test-file`,
            Body: file,
            ACL: 'public-read'
        };
        s3.upload(params, (error, data) => {
            if (error) console.error("Error is ", error)
            else console.error(data)

        })
    })
})