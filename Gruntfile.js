module.exports = function(grunt) {
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
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
            }
        }
    });

    grunt.loadNpmTasks('grunt-flash-compiler');
    grunt.registerTask('build_flash', ['flash']);
    grunt.loadNpmTasks('grunt-browserify');
    grunt.registerTask('build', ['flash', 'browserify']);
};