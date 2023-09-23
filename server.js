const express = require("express");
const app = express();
const http = require("http");
const fs = require("fs");
const crypto = require("crypto");
const server = http.Server(app);
const PORT = process.env.PORT || 3000;
const socketio = require("socket.io");
const io = socketio(server);
const mysql = require('mysql');
require("dotenv").config({path: ".env"});
const store_directory_path = "./src/store/";

const connection = mysql.createConnection({
    host: '127.0.0.1',
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE
});
connection.connect((err) => {
    if(err) throw err;
    console.log('Connected!');
});

app.get("/", function(req, res){
    res.sendFile(__dirname + "/src/index.html");
});
app.get("/mgmt", function(req, res){
    res.sendFile(__dirname + "/src/management/management.html");
});

app.use(express.static(__dirname + "/src/management"));
app.use(express.static(__dirname + "/src"));

server.listen(PORT, function(){
    console.log("server on port %d", PORT);
});

io.on("connection", function(socket){
    // console.log("connection: ", socket.id);
    socket.on('get_store_data', function(){//ページを開いた時要求
        connection.query('SELECT * FROM users', function(err, rows){//データベースすべて
            if(err) throw err;
            socket.emit("store_data", {data: rows});
        });
    });

    socket.on("send_food_data", function(data){ //フォームからの送信
        connection.query('UPDATE users SET time = ?, person = ?, total = ? Where storeName = ?', [data.time, data.person, data.total, data.storeName], function(err, result){//データベースアップデート
            if(err) throw err;
            connection.query('SELECT * FROM users', function(err, rows){//アップデートしたデータを送信
                if(err) throw err;
                socket.broadcast.emit("update_waiting_time", {data: rows});
            });
        });
    });

    socket.on("send_new_store_data", function(data){ //新規作成
        connection.query('SELECT * FROM users', function(err, rows){
            if(err) throw err;
            //ファイル名の生成
            let length = 16;
            let file_hash = crypto.randomBytes(length).toString("hex");
            let file_hash_status = true;
            if(rows.length != 0){
                do{ //同じファイル名ができなくなるまで生成し続ける
                    for(let i = 0; i < rows.length; i++){ //ファイル名固っぱりから見ていく
                        if(rows[i].url.split("/")[1].split(".")[0] == file_hash){ //同じのあったら生成し直し
                            file_hash = crypto.randomBytes(length).toString("hex");
                            break;
                        }else if(i == rows.length - 1){ //同じのなければ抜ける
                            file_hash_status = false;
                        }
                    }
                }while(file_hash_status)
            }

            create_new_form(data.newStoreName, file_hash); //フォーム生成
            let newUser = {storeName: data.newStoreName, time: 0, person: 0, total: 0, url: "store/" + file_hash + ".html", sellStatus: "selling"};
            connection.query('INSERT INTO users SET ?', newUser, function(err, res){ if(err) throw err; });//データベースに追加
            connection.query('SELECT * FROM users', function(err, rows){ io.emit("new_store_data", {data: rows}); });//アップデートしたデータを送信
        });
    });

    socket.on("edit_delete_func", function(data){ //名称変更，削除
        connection.query('SELECT * FROM users Where storeName = ?', [data.store_name], function(err, rows){//目的のダータを探す
            if(data.edit_status == "edit"){
                create_new_form(data.new_store_name, rows[0].url.split("/")[1].split(".")[0]); //フォームを上書き
                connection.query('UPDATE users SET storeName = ? Where storeName = ?', [data.new_store_name, data.store_name], function(err, result){ if(err) throw err; });//データベースアップデート
            }else{
                fs.unlink(store_directory_path + rows[0].url.split("/")[1], function(err){ if (err) throw err; });//ファイルを削除
                connection.query('DELETE FROM users Where storeName = ?', [data.store_name], function(err, result){ if(err) throw err; });//データベースから削除
            }
            connection.query('SELECT * FROM users', (err, rows) => {//アップデートしたデータを送信
                socket.emit("reload", {old_name:data.store_name, new_name:data.new_store_name, data: rows});
                socket.broadcast.emit("reload", {old_name:data.store_name, new_name:data.new_store_name, data: rows});
            });
        });
    });

    socket.on("outOfSold", function(data){ //売り切れ
        connection.query('UPDATE users SET sellStatus = ? Where storeName = ?', ["soldout", data], function(err, result){ if(err) throw err; });//データベースアップデート
        connection.query('SELECT * FROM users', function(err, rows){//アップデートしたデータを送信
            if(err) throw err;
            socket.broadcast.emit("update_soldOut", {data: rows});
            socket.broadcast.emit("update_waiting_time", {data: rows});
        });
    });
});

function create_new_form(newName, file_name){ //フォーム作成
    let data = `
    <!DOCTYPE html>
    <html lang="ja-JP">
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width">
            <title></title>
            <link rel="stylesheet" href="store.css">
            <!--<script src="/waiting-time/socket.io/socket.io.js"></script>-->
            <script src="/socket.io/socket.io.js"></script>
        </head>
        <body>
            <h1>${newName}</h1>
            <div style="display: flex;">
                <p>一人当たりの待ち時間</p><p class="waiting_time_PP_foodName">0</p><p>分</p>
                <button id="increase_waiting_time" class="form_btn">+5分</button>
                <button id="decrease_waiting_time" class="form_btn">-5分</button>
            </div>
            <div style="display: flex;">
                <p>待ち人数</p><p class="foodName_peopel">0</p><p>人</p>
                <button id="increase_people" class="form_btn">+1人</button>
                <button id="decrease_people" class="form_btn">-1人</button>
            </div>
    
            <button onclick="javascript:document.querySelector('dialog').showModal();">売り切れ</button>
            <dialog>
                <div id="dialog_div">
                    <p>ステータスを売り切れに変更します</p>
                    <p>この操作は取り消せません</p>
                    <button onclick="javascript:document.querySelector('dialog').close();">キャンセル</button>
                    <button onclick="outOfSold_run()">実行</button>
                </div>
            </dialog>
        </body>
        <script>
            const socket = io();
            //const socket = io("/", {path: "/" + location.pathname.split("/")[1] + "/socket.io/"});
            let foodName;
            let food_num_of_people = 0;
            let total_person = 0;
            let food_waiting_time_PP = 0;
            let url;

            document.querySelector("dialog").addEventListener("click", function(event){
                if(event.target.closest("#dialog_div") === null){
                    document.querySelector("dialog").close();
                };
            });

            socket.on("reload", function({old_name, new_name}){
                if(foodName == old_name){
                    foodName = new_name;
                    document.querySelector("h1").textContent = document.title = new_name;
                    document.querySelectorAll(".waiting_time_PP_foodName")[0].setAttribute("id", "waiting_time_PP_" + new_name);
                    document.querySelectorAll(".foodName_peopel")[0].setAttribute("id", new_name + "_people");
                }
            });

            function outOfSold_run(){
                socket.emit("outOfSold", foodName);
                document.querySelector("dialog").close();
                document.querySelectorAll("button").forEach(data => {
                    data.disabled = "disable";
                });
                document.getElementById("waiting_time_PP_" + foodName).textContent = "null";
                document.getElementById(foodName + "_people").textContent = "null";
            }

            socket.on("store_data", function({data}){
                foodName = document.querySelector("h1").textContent;
                document.title = foodName + "-入力フォーム";
                document.querySelectorAll(".waiting_time_PP_foodName")[0].setAttribute("id", "waiting_time_PP_" + foodName);
                document.querySelectorAll(".foodName_peopel")[0].setAttribute("id", foodName + "_people");
                let result = data;
                let sell_status;
                for(let i = 0; i < result.length; i++){
                    if(result[i].storeName == foodName){
                        food_num_of_people = result[i].person;
                        food_waiting_time_PP = result[i].time;
                        total_person = result[i].total;
                        url = result[i].url;
                        sell_status = result[i].sellStatus
                    }
                }
                document.getElementById("increase_waiting_time").setAttribute("onclick", "increase_waiting_time()");
                document.getElementById("decrease_waiting_time").setAttribute("onclick", "decrease_waiting_time()");
                document.getElementById("increase_people").setAttribute("onclick", "increase_people()");
                document.getElementById("decrease_people").setAttribute("onclick", "decrease_people()");
                if(sell_status == "soldout"){
                    document.getElementById("waiting_time_PP_" + foodName).textContent = "null";
                    document.getElementById(foodName + "_people").textContent = "null";
                    document.querySelectorAll("button").forEach(data => {
                        data.disabled = "disable";
                    });
                }else{
                    document.getElementById("waiting_time_PP_" + foodName).textContent = food_waiting_time_PP;
                    document.getElementById(foodName + "_people").textContent = food_num_of_people;
                }
            });

            document.addEventListener("DOMContentLoaded", function(){
                socket.emit("get_store_data");
            });

            function increase_waiting_time(){
                const waiting_time_PP = document.getElementById("waiting_time_PP_" + foodName);
                food_waiting_time_PP = food_waiting_time_PP + 5;
                waiting_time_PP.textContent = food_waiting_time_PP;
                if(food_num_of_people !== 0){
                    socket.emit("send_food_data", {storeName: foodName, time: food_waiting_time_PP, person: food_num_of_people, total: total_person});
                }
            }

            function decrease_waiting_time(){
                if(food_waiting_time_PP !== 0){
                    const waiting_time_PP = document.getElementById("waiting_time_PP_" + foodName);
                    food_waiting_time_PP = food_waiting_time_PP - 5;
                    waiting_time_PP.textContent = food_waiting_time_PP;
                    if(food_num_of_people !== 0){
                        socket.emit("send_food_data", {storeName: foodName, time: food_waiting_time_PP, person: food_num_of_people, total: total_person});
                    }
                }
            }

            function increase_people(){
                total_person++;
                const waiting_people = document.getElementById(foodName + "_people");
                food_num_of_people++;
                waiting_people.textContent = food_num_of_people;
                socket.emit("send_food_data", {storeName: foodName, time: food_waiting_time_PP, person: food_num_of_people, total: total_person});
            }

            function decrease_people(){
                if(food_num_of_people !== 0){
                    const waiting_people = document.getElementById(foodName + "_people");
                    food_num_of_people--;
                    waiting_people.textContent = food_num_of_people;
                    socket.emit("send_food_data", {storeName: foodName, time: food_waiting_time_PP, person: food_num_of_people, total: total_person});
                }
            }
        </script>
    </html>
    `;
    fs.writeFileSync(store_directory_path + file_name + ".html", data);
}