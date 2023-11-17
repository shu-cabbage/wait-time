# 出店待ち時間表示システム
## About
出店の待ち時間を表示する。  

## Install
mysql、nginx、node.jsをインストールする。  
`$ sudo apt install -y mysql-server nginx nodejs npm`

### mysql
最初にセキュリティスクリプトを実行する。  
`$ sudo mysql_secure_installation`  
色々聞かれるけど、だいたいYesでいいと思う。  

次に、`$ sudo mysql`でrootでログインする。  
mysqlのuserを作成する。  
```sql
> CREATE USER 'new user'@'localhost' IDENTIFIED BY 'new user password';
> GRANT ALL PRIVILEGES ON * . * TO 'new user'@'localhost';
> FLUSH PRIVILEGES;
> ALTER USER 'new user'@'localhost' IDENTIFIED WITH mysql_native_password BY 'new user password';
```

### node.js
node jsのインストールはちょっとクセがある。  
もっと楽なやり方があるのかもしれない。  
```sh
$ sudo npm install -g n
$ sudo n stable
$ sudo apt purge -y nodejs npm
```

## Use
使い方とセッティング  
サーバサイドは、M2pro macmini、i7 MBP、ubuntu serverで確認済み。  
クライアントサイドは、iPhone XR、iPhone 7、Xiaomi Mi 11 Lite 5Gで確認済み。  
### サーバ側
mysqlにdatabaseとtableを作る。  
database名とtable名を変えてもいいが、もれなくコードも変える必要が出てくるので、このままを推奨。  
```sql
> CREATE DATABASE waitTime;
> USE waitTime;
> CREATE TABLE users (storeName TEXT, time INT UNSIGNED, person INT UNSIGNED, total INT UNSIGNED, url TEXT, sellStatus TEXT);
```  
nginx.confにlocationを追記する。  
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
git cloneしてディレクトリ移動して、`$ npm install`。  
envファイルに上で設定したデータベースのログイン項目を書く。  
`$ node server.js`で走らせる。  
メインのurlは、http(s)://<ドメイン>/wait-time/  
管理画面のurlは、http(s)://<ドメイン>/wait-time/mgmt/  
### 管理側
管理画面から、出店それぞれの入力フォームを生成する。  
そのフォームurlをコピーできるので、出店に渡す。  
デジタルサイネージなどを用意し、メイン画面を表示させる。  
### 出店側
一人当たりの待ち時間と待ち人数を都度いれる。  
売り切れになった場合もそのフォームで送れば、反映される。