module.exports = function(grunt) {
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        browserify: {
            flashphonerGlobalObject: {
                src: ['./src/flashphoner-core.js', "./src/constants.js'", "./src/webrtc-media-provider.js'"],
                dest: './flashphoner.js',
                options: {
                    browserifyOptions: {
                        standalone: 'Flashphoner'
                    }
                }
            }
        }
    });

    grunt.loadNpmTasks('grunt-browserify');
    grunt.registerTask('build', ['browserify']);
};