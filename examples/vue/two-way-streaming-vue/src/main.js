import Vue from 'vue';
import 'bootstrap/dist/css/bootstrap.css';
import TwoWayStreamingApp from './TwoWayStreamingApp.vue';

Vue.config.productionTip = false

new Vue({
  render: h => h(TwoWayStreamingApp),
}).$mount('#app')
