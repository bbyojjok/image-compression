CREATE TABLE completed(
	id int(10) NOT NULL AUTO_INCREMENT,
	ip varchar(20) NOT NULL,
	browser varchar(20) NOT NULL,
	created_key varchar(30) NOT NULL,
	compressibility varchar(10) NOT NULL,
	zip_url varchar(100) NOT NULL,
	before_filesize varchar(30) NOT NULL,
	after_filesize varchar(30) NOT NULL,
	created datetime NOT NULL,
	PRIMARY KEY (id)
);
