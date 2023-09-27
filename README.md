# 出店待ち時間表示システム
## About
出店の待ち時間を表示する

## Install
mysql、nginxをインストールする。  
userを作成する。  
まずrootでログインする。  
```sh
mysql> CREATE USER 'new user'@'localhost' IDENTIFIED BY 'new user password';
mysql> GRANT ALL PRIVILEGES ON * . * TO 'new user'@'localhost';
mysql> FLUSH PRIVILEGES;
mysql> ALTER USER 'new user'@'localhost' IDENTIFIED WITH mysql_native_password BY 'new user password';
```
databaseとtableを作る。  
```sh
mysql> CREATE DATABASE waitTime;
mysql> USE waitTime;
mysql> CREATE TABLE users (storeName TEXT, time INT UNSIGNED, person INT UNSIGNED, total INT UNSIGNED, url TEXT, sellStatus TEXT);
```  
nginx.confにlocationを書く。  
```nginx
location /wait-time/ {
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header Host $host;
    proxy_pass http://localhost:3000/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}
```
git cloneして、
``npm install``

## Use
使い方とセッティング  
M2pro macmini、i7 MBP、ubuntu serverで確認済み
### サーバ側
envファイルにデータベースのログイン項目を書く。  
``node server.js``で走らせる。
### 管理側
管理画面から、出店それぞれの管理フォームを生成する。  
デジタルサイネージなどを用意し、表示させる。
### 出店側
一人当たりの待ち時間と待ち人数を都度いれる。
