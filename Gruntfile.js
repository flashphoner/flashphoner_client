module.exports = function(grunt) {
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        'string-replace': {
            version: {
                files: {
                    'src/flashphoner-core.js': 'src/flashphoner-core.js'
                },
                options: {
                    replacements: [
                        {
                            pattern: /clientVersion: "([0-9]+).([0-9]+).([0-9]+)"/,
                            replacement: 'clientVersion: "<%= pkg.version %>"'
                        }
                    ]
                }
            }
        },
        flash: {
            options: {
                sdk: env.FLEX_HOME,
                flashVersion: '11.1'
            },
            debug : {
                options : {
                    debug : true
                },
                files : {
                    'test/media-provider.swf' : 'src/flash/MediaProvider.mxml'
                }
            },
            release_media_provider : {
                files : {
                    'media-provider.swf' : 'src/flash/MediaProvider.mxml'
                }
            },
            release_examples_streaming : {
                files : {
                    'examples/demo/streaming/flash_client/streaming/bin/streaming.swf' : 'examples/demo/streaming/flash_client/streaming/src/streaming.mxml'
                }
            },
            release_examples_chat : {
                files : {
                    'examples/demo/streaming/flash_client/chat/bin/chat.swf' : 'examples/demo/streaming/flash_client/chat/src/chat.mxml'
                }
            }
        },
        browserify: {
            flashphonerGlobalObject: {
                src: ['./src/flashphoner-core.js'],
                dest: './flashphoner.js',
                options: {
                    ignore: ['./src/temasys-media-provider.js', 'adapterjs'],
                    transform: [['babelify', {presets: ["@babel/preset-env", { "sourceType": "unambiguous" }], global: true, exclude: ['./src/media-source-media-provider.js','./src/media-source-media-provider.min.js']}]],
                    browserifyOptions: {
                        standalone: 'Flashphoner'
                    }
                }
            },
            flashphonerGlobalObjectNoWebRTC: {
                src: ['./src/flashphoner-core.js'],
                dest: './flashphoner-no-webrtc.js',
                options: {
                    ignore: ['./src/temasys-media-provider.js', 'adapterjs', './src/webrtc-media-provider.js'],
		    transform: [['babelify', {presets: ["@babel/preset-env", { "sourceType": "unambiguous" }], global: true}]],
                    browserifyOptions: {
                        standalone: 'Flashphoner'
                    }
                }
            },
            flashphonerGlobalObjectNoFlash: {
                src: ['./src/flashphoner-core.js'],
                dest: './flashphoner-no-flash.js',
                options: {
                    ignore: ['./src/temasys-media-provider.js', 'adapterjs', './src/flash-media-provider.js'],
                    transform: [['babelify', {presets: ["@babel/preset-env", { "sourceType": "unambiguous" }], global: true}]],
                    browserifyOptions: {
                        standalone: 'Flashphoner'
                    }
                }
            },
            flashphonerGlobalObjectNoWSPlayer: {
                src: ['./src/flashphoner-core.js'],
                dest: './flashphoner-no-wsplayer.js',
                options: {
                    ignore: ['./src/temasys-media-provider.js', 'adapterjs', './src/websocket-media-provider.js'],
                    transform: [['babelify', {presets: ["@babel/preset-env", { "sourceType": "unambiguous" }], global: true}]],
                    browserifyOptions: {
                        standalone: 'Flashphoner'
                    }
                }
            },
            flashphonerGlobalObjectTemasys: {
                src: ['./src/flashphoner-core.js'],
                dest: './flashphoner-temasys-flash-websocket-without-adapterjs.js',
                options: {
                    ignore: ['adapterjs','./src/webrtc-media-provider.js'],
		    transform: [['babelify', {presets: ["@babel/preset-env", { "sourceType": "unambiguous" }], global: true}]],
                    browserifyOptions: {
                        standalone: 'Flashphoner'
                    }
                }
            },
            flashphonerGlobalObjectRestApi: {
                src: ['./src/rest-module.js'],
                dest: './flashphoner-rest-api.js',
                options: {
                    browserifyOptions: {
                        standalone: 'FlashphonerRestApi'
                    }
                }
            }
        },
        //used for resolve https://github.com/Temasys/AdapterJS/issues/238
        concat: {
            AdapterJS: {
                src: ['./node_modules/adapterjs/publish/adapter.debug.js', './flashphoner-temasys-flash-websocket-without-adapterjs.js'],
                dest: './flashphoner-temasys-flash-websocket.js'
            }
        },
        uglify: {
          options: {
              compress: {
                  typeofs: false
              },
              mangle: false
          },
          minify: {
              files: {
                  './flashphoner.min.js' : ['./flashphoner.js'],
                  './flashphoner-no-webrtc.min.js': ['./flashphoner-no-webrtc.js'],
                  './flashphoner-no-flash.min.js': ['./flashphoner-no-flash.js'],
                  './flashphoner-no-wsplayer.min.js': ['./flashphoner-no-wsplayer.js'],
                  './flashphoner-temasys-flash-websocket.min.js':['./flashphoner-temasys-flash-websocket.js']
              }
          }
        },
        jsdoc: {
            src: ['./src/flashphoner-core.js', './src/constants.js', './src/room-module.js'],
            options: {
                template: './docTemplate',
                readme: './docTemplate/README.md',
                destination: 'doc'
            }
        },
        copy: {
            main: {
                files: [
                    {
                        expand: true,
                        cwd: './',
                        src: [
                            'flashphoner.js',
                            'flashphoner-no-flash.js',
                            'flashphoner-no-webrtc.js',
                            'flashphoner-no-wsplayer.js',
                            'flashphoner-temasys-flash-websocket.js',
                            'flashphoner.min.js',
                            'flashphoner-no-flash.min.js',
                            'flashphoner-no-webrtc.min.js',
                            'flashphoner-no-wsplayer.min.js',
                            'flashphoner-temasys-flash-websocket.min.js',
                            'flashphoner-rest-api.js',
                            'media-provider.swf'
                        ],
                        dest: 'release/<%= pkg.name %>-<%= pkg.version %>'
                    },
                    {
                        expand: true,
                        cwd: './',
                        src: ['doc/**'],
                        dest: 'release/<%= pkg.name %>-<%= pkg.version %>'
                    },
                    {
                        expand: true,
                        cwd: './',
                        src: ['examples/**'],
                        dest: 'release/<%= pkg.name %>-<%= pkg.version %>'
                    }
                ]
            }
        },
        clean: {
            build: [
                'flashphoner.js',
                'flashphoner-no-flash.js',
                'flashphoner-no-webrtc.js',
                'flashphoner-no-wsplayer.js',
                'flashphoner-temasys-flash-websocket-without-adapterjs.js',
                'flashphoner-temasys-flash-websocket.js',
                'flashphoner.min.js',
                'flashphoner-no-flash.min.js',
                'flashphoner-no-webrtc.min.js',
                'flashphoner-no-wsplayer.min.js',
                'flashphoner-temasys-flash-websocket.min.js',
                'flashphoner-rest-api.js',
                'media-provider.swf',
                'doc/'
            ],
            release: [
                'release'
            ]
        }
    });

    grunt.loadNpmTasks('grunt-flash-compiler');
    grunt.loadNpmTasks('grunt-browserify');
    grunt.loadNpmTasks('grunt-contrib-concat');
    grunt.loadNpmTasks('grunt-jsdoc');
    grunt.loadNpmTasks('grunt-contrib-copy');
    grunt.loadNpmTasks('grunt-string-replace');
    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.registerTask('build', [
        'clean:build',
        'string-replace:version',
        'flash:release_media_provider',
        'browserify',
        'concat',
        'uglify',
        'flash:release_examples_streaming',
        'flash:release_examples_chat',
        'jsdoc'

    ]);
    grunt.registerTask('release', [
        'clean:release',
        'build',
        'copy'
    ]);
};