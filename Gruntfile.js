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
            release : {
                files : {
                    'media-provider.swf' : 'src/flash/MediaProvider.mxml'
                }
            }
        },
        browserify: {
            flashphonerGlobalObject: {
                src: ['./src/flashphoner-core.js'],
                dest: './flashphoner.js',
                options: {
                    browserifyOptions: {
                        standalone: 'Flashphoner'
                    }
                }
            },
            flashphonerGlobalObjectNoWebRTC: {
                src: ['./src/flashphoner-core.js'],
                dest: './flashphoner-no-webrtc.js',
                options: {
                    ignore: ['./src/webrtc-media-provider.js'],
                    browserifyOptions: {
                        standalone: 'Flashphoner'
                    }
                }
            },
            flashphonerGlobalObjectNoFlash: {
                src: ['./src/flashphoner-core.js'],
                dest: './flashphoner-no-flash.js',
                options: {
                    ignore: ['./src/flash-media-provider.js'],
                    browserifyOptions: {
                        standalone: 'Flashphoner'
                    }
                }
            }
        },
        jsdoc: {
            src: ['./src/flashphoner-core.js', './src/constants.js'],
            options: {
                destination: 'doc'
            }
        },
        copy: {
            main: {
                files: [
                    {
                        expand: true,
                        cwd: './',
                        src: ['flashphoner.js', 'media-provider.swf'],
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
                        src: ['example/**'],
                        dest: 'release/<%= pkg.name %>-<%= pkg.version %>'
                    }
                ]
            }
        }
    });

    grunt.loadNpmTasks('grunt-flash-compiler');
    grunt.registerTask('build_flash', ['flash']);
    grunt.loadNpmTasks('grunt-browserify');
    grunt.loadNpmTasks('grunt-jsdoc');
    grunt.loadNpmTasks('grunt-contrib-copy');
    grunt.loadNpmTasks('grunt-string-replace');
    grunt.registerTask('build', ['string-replace:version','flash', 'browserify', 'jsdoc']);
    grunt.registerTask('release', ['build', 'copy']);
};