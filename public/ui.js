var ImageCompression = (function(window, document, $) {
  function imageCompression() {
    this.files = [];
    this.isLoading = false;
    this.$uploadList = $('#uploadList');
    this.$uploadArea = $('#uploadArea');
    this.$fileUploadInput = $('#fileUploadInput');
    this.$fileUploadSubmit = $('#fileUploadSubmit');
    this.$completedArea = $('#completedArea');
    this.$dimmed = $('#dimmed');
    this.isAdvancedUpload = (function() {
      var div = document.createElement('div');
      return (
        ('draggable' in div || ('ondragstart' in div && 'ondrop' in div)) &&
        'FormData' in window &&
        'FileReader' in window
      );
    })();

    this.init();
  }

  imageCompression.prototype = {
    /**
     * init() binding event
     */
    init: function() {
      var _this = this;

      // $uploadArea drag and drop
      if (_this.isAdvancedUpload) {
        _this.$uploadArea.bind('dragenter, dragover', function(e) {
          e.preventDefault();
          e.stopPropagation();
          _this.$uploadArea.addClass('over');
        });

        _this.$uploadArea.bind('dragleave', function(e) {
          e.preventDefault();
          e.stopPropagation();
          _this.$uploadArea.removeClass('over');
        });

        _this.$uploadArea.bind('drop', function(e) {
          e.preventDefault();
          e.stopPropagation();
          if (_this.isLoading) return false;

          _this.$uploadList.removeClass('active').empty();
          _this.$uploadArea.removeClass('over').addClass('active');
          _this.files = [];

          _this.getFiles(e, _this.makeList);
        });
      }

      // $uploadArea click
      _this.$uploadArea.find('a').bind('click', function() {
        if (_this.isLoading) return false;
        _this.$fileUploadInput.trigger('click');
        return false;
      });

      // $fileUploadInput change
      _this.$fileUploadInput.bind('change', function(e) {
        _this.$uploadArea.addClass('active');
        _this.getFiles(e, _this.makeList);
      });

      // $fileUploadSubmit submit
      _this.$fileUploadSubmit.bind('click', function() {
        if (_this.isLoading) return false;
        _this.filesSubmit(_this.files);
        return false;
      });
    },

    /**
     * templateCompleted() template
     * @param {object} data
     * @return {string}
     */
    templateCompleted: function(data) {
      var templateCompleted = '<h2>Completed</h2>';
      templateCompleted += '<ul>';
      templateCompleted += '	<li>before filesize: ' + data.beforeSizeFormatBytes + '</li>';
      templateCompleted += '	<li>after filesize: ' + data.afterSizeFormatBytes + '</li>';
      templateCompleted += '	<li>compressibility : ' + data.compressibility + '</li>';
      templateCompleted += '</ul>';
      templateCompleted +=
        '<a href="/uploads/' +
        data.createdKey +
        '_images.zip" download="' +
        data.createdKey +
        '_images.zip" target="_blank">completed zipfile ' +
        data.createdKey +
        '_images.zip</a>';
      templateCompleted += '';
      return templateCompleted;
    },

    /**
     * filesSubmit() submit
     * @param {obejct} files
     */
    filesSubmit: function(files) {
      var _this = this;

      if (files.length > 0) {
        _this.isLoading = true;
        _this.$dimmed.show();

        var formData = new FormData();
        for (var i = 0; i < files.length; i++) {
          var file = files[i];
          formData.append('userFile[]', file, file.name);
        }

        $.ajax({
          url: '/api/upload',
          type: 'POST',
          data: formData,
          processData: false,
          contentType: false,
          success: function(data) {
            console.log(data);
            _this.$completedArea
              .addClass('active')
              .empty()
              .append(_this.templateCompleted(data));
            _this.$dimmed
              .hide()
              .find('.msg .txt')
              .text('image uploading')
              .end()
              .find('.percentBar span')
              .width(0);
            _this.isLoading = false;
          },
          xhr: function() {
            var xhr = new XMLHttpRequest();

            // progress
            xhr.upload.addEventListener(
              'progress',
              function(evt) {
                if (evt.lengthComputable) {
                  var percentComplete = parseInt((evt.loaded / evt.total) * 100);
                  _this.$dimmed.find('.percent').text(percentComplete + '%');
                  _this.$dimmed.find('.percentBar span').width(percentComplete + '%');

                  if (percentComplete === 100) {
                    _this.$dimmed
                      .find('.msg .txt')
                      .text('doing compressed')
                      .end()
                      .find('.percent')
                      .text('');
                  }
                }
              },
              false
            );

            // fail received/failed
            xhr.onreadystatechange = function(e) {
              if (xhr.readyState === 4) console.log(xhr.status);
            };

            return xhr;
          }
        });
      } else {
        alert('please upload file or drag and drop file.');
      }
    },

    /**
     * getFiles() input change, drag drop doit get files
     * @param {event} e
     * @param {function} callback
     */
    getFiles: function(e, callback) {
      if (!callback || typeof callback !== 'function') return;

      var _this = this;
      var files;
      _this.$completedArea.removeClass('active').empty();

      if (e.originalEvent.dataTransfer) {
        // type drag
        files = e.originalEvent.dataTransfer.files;
        if (files.length) {
          if (e.originalEvent.dataTransfer.items) {
            // folder drag support
            var items = e.originalEvent.dataTransfer.items;
            if (items && items.length && items[0].webkitGetAsEntry != null) {
              // webkitGetAsEntry support
              for (var i = 0; i < items.length; i++) {
                var entry = items[i].webkitGetAsEntry();
                if (entry) _this.scanFiles(entry);
              }
            } else {
              // webkitGetAsEntry not support
              alert('browser does not support webkitGetAsEntry');
            }
          } else {
            // folder drag not support
            _this.files = files;
            callback.call(_this, files);
          }
        } else {
          _this.$uploadArea.removeClass('active');
          alert('browser does not support dragging folders');
        }
      } else if (e.target) {
        // type input
        files = e.target.files;
        if (files.length > 0) {
          // doing upload
          _this.files = files;
          callback.call(_this, files);
        } else {
          // cancel upload
          _this.$uploadList.removeClass('active').empty();
          _this.$uploadArea.removeClass('active');
        }
      }
    },

    /**
     * imageFileExtensionCheck() imagae validation
     * @param {string} filename
     * @return {boolean}
     */
    imageFileExtensionCheck: function(filename) {
      return /\.(gif|jpg|jpeg|svg|png)$/i.test(filename);
    },

    /**
     * scanFiles() folder files scan
     * @param {object} entry
     */
    scanFiles: function(entry) {
      var _this = this;
      if (entry.isDirectory) {
        // folder
        var dirReader = entry.createReader();
        dirReader.readEntries(function(entries) {
          entries.forEach(function(file) {
            _this.scanFiles(file);
          });
        });
      } else if (entry.isFile) {
        // file
        entry.file(function(file) {
          _this.files.push(file);
          _this.makeList(file);
        });
      }
    },

    /**
     * templateList() template list
     * @param {obejct} object
     * @return {string}
     */
    templateList: function(file) {
      var _this = this;
      var templateList = '<div>';
      templateList += '<p>' + file.name + '</p>';
      if (_this.imageFileExtensionCheck(file.name)) {
        templateList += '<img src="' + URL.createObjectURL(file) + '" />';
      }
      templateList += '</div>';
      return templateList;
    },

    /**
     * makeList() element list add
     * @param {object} files
     */
    makeList: function(files) {
      var _this = this;
      var list = '';
      if (files.length !== undefined) {
        // type input change
        for (var i = 0; i < files.length; i++) {
          list += _this.templateList(files[i]);
        }
        _this.$uploadList
          .addClass('active')
          .empty()
          .append(list);
      } else {
        // type drag drop
        list = _this.templateList(files);
        _this.$uploadList.addClass('active').append(list);
      }
    }
  };

  return imageCompression;
})(window, document, jQuery);

$(function() {
  new ImageCompression();
});
