import { createApp, h, ref } from 'vue'
import BiCityMeetingBoard from '@/views/supply-chain/bi/components/BiCityMeetingBoard.vue'
import BiMeetingBoard from '@/views/supply-chain/bi/components/BiMeetingBoard.vue'
import { cityMeetingFixture } from './bi-city-meeting-data'
createApp({
  setup() {
    const all = ref(cityMeetingFixture())
    const region = ref('CITY-0')
    const snapshot = ref(cityMeetingFixture(region.value))
    const mode = ref('city')
    const select = (code: string) => {
      region.value = code
      snapshot.value = cityMeetingFixture(code)
    }
    const refresh = () => {
      all.value = cityMeetingFixture()
      select(region.value)
    }
    const common = {
      month: '2026-09',
      maxMonth: '2026-09',
      scopeLabel: '全部授权城市 · 演示',
      demo: true,
      onRefresh: refresh,
      onMonth: refresh,
      onPeriod: refresh,
      onClose: () => {
        mode.value = 'closed'
      },
    }
    return () =>
      mode.value === 'city'
        ? h(BiCityMeetingBoard, {
            ...common,
            snapshot: snapshot.value,
            allSnapshot: all.value,
            regionCode: region.value,
            onCity: select,
            onBack: () => {
              mode.value = 'overview'
            },
            onReport: () => window.alert('演示页：正式入口将沿用城市与月份进入业务报表。'),
          })
        : mode.value === 'overview'
          ? h(BiMeetingBoard, {
              ...common,
              snapshot: all.value,
              onCity: () => {
                mode.value = 'city'
              },
              'onOpen-report': () => window.alert('演示页：正式入口将打开对应报表。'),
            })
          : h(
              'button',
              {
                onClick: () => {
                  mode.value = 'city'
                },
              },
              '重新打开城市看板',
            )
  },
}).mount('#app')
