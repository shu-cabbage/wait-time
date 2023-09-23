# 出店待ち時間表示システム
## About
出店の待ち時間を表示する

## Install
mysqlをインストールする。  
databaseとtableを作る。  
以下macでのコマンド。  
```sh
mysql> CREATE DATABASE waitTime;
mysql> USE waitTime;
mysql> CREATE TABLE users (storeName TEXT, time INT UNSIGNED, person INT UNSIGNED, total INT UNSIGNED, url TEXT, sellStatus TEXT);
```  
git cloneする。  
``npm install``

## Use
使い方とセッティング  
M2 proでのみ確認済み
### サーバ側
envファイルにデータベースのログイン項目を書く。  
``node server.js``で走らせる。
### 管理側
管理画面から、出店それぞれの管理フォームを生成する。  
デジタルサイネージなどを用意し、表示させる。
### 出店側
一人当たりの待ち時間と待ち人数を都度いれる。
