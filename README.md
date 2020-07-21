## Tweets Monitor

O objetivo deste trabalho é analisar, em tempo real, tweets sobre um certo assunto. Devido à limitações da API do Twitter, a quantidade de tweets ser bem reduzida em relação ao real.

O repositório conta com duas implementações principais:

* Cosumidor, feito em Scala, que consome os tweets, utilizando o Twitter4J, e disponibiliza um `Source` para consumir em tempo real (Akka Stream). Os tweets são também armazenados no MongoDB;

* Front-End, feito (principalmente) com React, D#, Dc.js, Crossfilter.js, AntV e Ant Desing. A aplicação conta com duas telas: uma para analisar os tweets em tempo real, permitindo ver a contagem dos tweets, e uma para analisar os tweets consumidos, permitindo análises um pouco mais complexas.

### Executando o consumidor

Para executá-lo, é necessário a criação de uma aplicação no [Twitter Developer](https://developer.twitter.com/en/apps), onde serão obtidas as credenciais para executar a aplicação. As credenciais deverão estar disponíveis em 4 variáveis de ambiente:
* consumerKey
* consumerSecret
* accessToken
* accessTokenSecret

**OBS**: caso queira, pode modificar o arquivo `src/main/resources/application.conf` e colocar suas credenciais lá.

Para rodar, é necessário ter o [sbt](https://www.scala-sbt.org/) instalado.  Além disso, é necessário tem um MongoDB executando. Neste repositório, temos o arquivo `mongo-docker-compose.yml` que permite (utilizando o docker-compose) instanciar um MongoDB na máquina. Para isso, basta executar `docker-compose -f mongo-docker-compose.yml up -d`.

Tendo as variáveis de ambiente configuradas (ou adicionando elas no arquivo de configuração) e o MongoDB rodando, basta executar a classe `StreamTest`.


### WebApp e API
O código fonte do WebApp encontra-se na pasta `webapp-source`.  
Para rodar a aplicação, execute (no diretório `webapp-source`) `npm install` (apenas na primeira vez que for executar) e `npm start`.

O WebApp espera uma API executando na porta `9000` com os seguintes endpoints:

* `/tweets?keywords` - um websocket que retorna os tweets, em tempo real, que satisfaçam as palavras chaves enviadas no parâmetro `keywords`, que é uma `String`;

* `/historical-tweets` - um array de tweets seguindo o modelo do Consumidor