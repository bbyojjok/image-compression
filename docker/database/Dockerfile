FROM mysql:latest

ENV MYSQL_ROOT_PASSWORD 1q2w3e
ENV MYSQL_DATABASE imagecompression
ENV MYSQL_ROOT root
ENV MYSQL_PASSWORD 1q2w3e
ENV TZ='Asia/Seoul'

ADD ./setup.sql /docker-entrypoint-initdb.d/
