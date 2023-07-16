const express = require("express");
const app = express();
const http = require("http");
const fs = require("fs");
const crypto = require("crypto");
const server = http.Server(app);
const PORT = process.env.PORT || 3000;
const socketio = require("socket.io");
const io = socketio(server);

const data_file_path = "./src/foods.json";
const store_directory_path = "./src/store/";

app.get("/", (req, res) => {
    res.sendFile(__dirname + "/src/index.html");
});
app.get("/mgmt", (req, res) => {
    res.sendFile(__dirname + "/src/management/management.html");
});

app.use(express.static(__dirname + "/src/management"));
app.use(express.static(__dirname + "/src"));

server.listen(PORT, () => {
    console.log("server on port %d", PORT);
});

io.on("connection", (socket) => {
    console.log("connection: ", socket.id);
    socket.on("send_food_data", (data) => { //フォームからの送信
        sort_foods(data);
        socket.broadcast.emit("update_waiting_time", data.foodName);
    });

    socket.on("send_new_store_data", (data) => { //新規作成
        let masterData = JSON.parse(fs.readFileSync(data_file_path, "utf-8"));
        let length = 16;
        let file_hash = crypto.randomBytes(length).toString("hex");
        let file_hash_status = true;
        if(masterData.foods.length != 0){
            do{ //同じファイル名ができなくなるまで生成し続ける
                // let val = 0;
                for(let i = 0; i < masterData.foods.length; i++){ //ファイル名固っぱりから見ていく
                    if(masterData.foods[i].url.split("/")[1].split(".")[0] == file_hash){ //同じのあったら生成し直し
                        file_hash = crypto.randomBytes(length).toString("hex");
                        break;
                    }else if(i == masterData.foods.length - 1){ //同じのなければ抜ける
                        file_hash_status = false;
                        // val++;
                    }
                    // if(val == masterData.foods.length){
                    //     file_hash_status = false;
                    // }
                }
            }while(file_hash_status)
        }
        data.newStoreData.url = "store/" + file_hash + ".html"; //パス生成
        masterData.foods.push(data.newStoreData);

        fs.writeFileSync(data_file_path, JSON.stringify(masterData, null, "    "));
        create_new_form(data.newStoreData.food, file_hash); //フォーム生成
        socket.broadcast.emit("reload", "");
        socket.emit("reload", "");
    });

    socket.on("edit_delete_func", (data) => { //名称変更，削除
        edit_foods(data);
        socket.emit("reload", {old_name:data.store_name, new_name:data.new_store_name});
        socket.broadcast.emit("reload", {old_name:data.store_name, new_name:data.new_store_name});
    });

    socket.on("outOfSold", (data) => { //売り切れ
        outOfSold_food(data);
        socket.emit("reload", "");
        socket.broadcast.emit("reload", "");
    });
});

function outOfSold_food(data){ //売り切れ表示
    let masterData = JSON.parse(fs.readFileSync(data_file_path, "utf-8"));
    for(let i = 0; i < masterData.foods.length; i++){
        if(json_data.foods[i].food == data){ //該当のものを探す
            json_data.foods[i].sell_status = "soldout"; //売り切れにする
            break;
        }
    }
    fs.writeFileSync(data_file_path, JSON.stringify(masterData, null, "    "));
}

function edit_foods(data){ //名称変更，削除
    let masterData = JSON.parse(fs.readFileSync(data_file_path, "utf-8"));
    for(let i = 0; i < masterData.foods.length; i++){
        if(data.store_name == masterData.foods[i].food){ //該当のものを探す
            if(data.edit_status == "edit"){ //編集の時，名前を変える
                masterData.foods[i].food = data.new_store_name;
                create_new_form(data.new_store_name, masterData.foods[i].url.split("/")[1].split(".")[0]); //フォームを上書き
                break;
            }else{ //削除の時
                fs.unlink(store_directory_path + masterData.foods[i].url.split("/")[1], (err) => { //ファイルを削除
                    if (err) throw err;
                    console.log('deleted file');
                });
                masterData.foods.splice(i, 1); //jsonオブジェクトから削除
                break;
            }
        }
    }
    fs.writeFileSync(data_file_path, JSON.stringify(masterData, null, "    "));
}

function sort_foods(food_data){ //待ち時間更新
    let masterData = JSON.parse(fs.readFileSync(data_file_path, "utf-8"));
    for(let i = 0; i < masterData.foods.length; i++){
        if(masterData.foods[i].food == food_data.foodName){ //該当のものを探す
            masterData.foods[i].time = food_data.time;
            masterData.foods[i].person = food_data.person;
            masterData.foods[i].total = food_data.total;
            break;
        }
    }
    fs.writeFileSync(data_file_path, JSON.stringify(masterData, null, "    "));
}

function create_new_form(newName, file_name){ //フォーム作成
    let data = `
    <!DOCTYPE html>
    <html lang="ja-JP">
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width">
            <title></title>
            <link rel="stylesheet" href="store.css">
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
            let foodName;
            let food_num_of_people = 0;
            let total_person = 0;
            let food_waiting_time_PP = 0;
            let url;
            let sell_status;

            document.querySelector("dialog").addEventListener("click", function(event){
                if(event.target.closest("#dialog_div") === null){
                    document.querySelector("dialog").close();
                };
            });

            socket.on("reload", function(data){
                if(foodName == data.old_name && data != ""){
                    foodName = data.new_name;
                    document.querySelector("h1").textContent = document.title = foodName;
                    document.querySelectorAll(".waiting_time_PP_foodName")[0].setAttribute("id", "waiting_time_PP_" + foodName);
                    document.querySelectorAll(".foodName_peopel")[0].setAttribute("id", foodName + "_people");
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
    
            async function doAjaxThings(){
                foodName = document.querySelector("h1").textContent;
                document.title = foodName + "-入力フォーム";
                document.querySelectorAll(".waiting_time_PP_foodName")[0].setAttribute("id", "waiting_time_PP_" + foodName);
                document.querySelectorAll(".foodName_peopel")[0].setAttribute("id", foodName + "_people");
                let result = await makeRequest("GET", "./../foods.json");
                for(let i = 0; i < result.foods.length; i++){
                    if(result.foods[i].food == foodName){
                        food_num_of_people = result.foods[i].person;
                        food_waiting_time_PP = result.foods[i].time;
                        total_person = result.foods[i].total;
                        url = result.foods[i].url;
                        sell_status = result.foods[i].sell_status
                    }
                }
                document.getElementById("increase_waiting_time").setAttribute("onclick", "increase_waiting_time()");
                document.getElementById("decrease_waiting_time").setAttribute("onclick", "decrease_waiting_time()");
                document.getElementById("increase_people").setAttribute("onclick", "increase_people()");
                document.getElementById("decrease_people").setAttribute("onclick", "decrease_people()");
                if(sell_status == "soldout"){
                    document.getElementById("waiting_time_PP_" + foodName).textContent = "null";
                    document.getElementById(foodName + "_people").textContent = "null";
                }else{
                    document.getElementById("waiting_time_PP_" + foodName).textContent = food_waiting_time_PP;
                    document.getElementById(foodName + "_people").textContent = food_num_of_people;
                }
                if(sell_status == "soldout"){
                    document.querySelectorAll("button").forEach(data => {
                        data.disabled = "disable";
                    });
                }
            }
    
            function makeRequest(method, url){
                return new Promise(function (resolve, reject){
                    let xhr = new XMLHttpRequest();
                    xhr.open(method, url);
                    xhr.onload = function (){
                        if(this.status >= 200 && this.status < 300){
                            resolve(JSON.parse(xhr.response));
                        }else{
                            reject({
                                status: this.status,
                                statusText: xhr.statusText
                            });
                        }
                    }
                    xhr.onerror = function(){
                        reject({
                            status: this.status,
                            statusText: this.statusText
                        });
                    }
                    xhr.send();
                });
            }
    
            document.addEventListener("DOMContentLoaded", function(){
                doAjaxThings();
            });
    
            function increase_waiting_time(){
                const waiting_time_PP = document.getElementById("waiting_time_PP_" + foodName);
                food_waiting_time_PP = food_waiting_time_PP + 5;
                waiting_time_PP.textContent = food_waiting_time_PP;
                if(food_num_of_people !== 0){
                    socket.emit("send_food_data", {foodName: foodName, time: food_waiting_time_PP, person: food_num_of_people, total: total_person, url:url});
                }
            }
    
            function decrease_waiting_time(){
                if(food_waiting_time_PP !== 0){
                    const waiting_time_PP = document.getElementById("waiting_time_PP_" + foodName);
                    food_waiting_time_PP = food_waiting_time_PP - 5;
                    waiting_time_PP.textContent = food_waiting_time_PP;
                    if(food_num_of_people !== 0){
                        socket.emit("send_food_data", {foodName: foodName, time: food_waiting_time_PP, person: food_num_of_people, total: total_person, url:url});
                    }
                }
            }
    
            function increase_people(){
                total_person++;
                const waiting_people = document.getElementById(foodName + "_people");
                food_num_of_people++;
                waiting_people.textContent = food_num_of_people;
                socket.emit("send_food_data", {foodName: foodName, time: food_waiting_time_PP, person: food_num_of_people, total: total_person, url:url});
            }
    
            function decrease_people(){
                if(food_num_of_people !== 0){
                    const waiting_people = document.getElementById(foodName + "_people");
                    food_num_of_people--;
                    waiting_people.textContent = food_num_of_people;
                    socket.emit("send_food_data", {foodName: foodName, time: food_waiting_time_PP, person: food_num_of_people, total: total_person, url:url});
                }
            }
        </script>
    </html>`;
    fs.writeFileSync(store_directory_path + file_name + ".html", data);
}