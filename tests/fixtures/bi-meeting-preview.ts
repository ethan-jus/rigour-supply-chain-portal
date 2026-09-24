import { createApp, h, ref } from 'vue'
import BiMeetingBoard from '@/views/supply-chain/bi/components/BiMeetingBoard.vue'
import { meetingFixture } from './bi-meeting-data'

createApp({
  setup() {
    const snapshot = ref(meetingFixture())
    const open = ref(true)
    return () =>
      open.value
        ? h(BiMeetingBoard, {
            snapshot: snapshot.value,
            month: '2026-09',
            maxMonth: '2026-09',
            scopeLabel: '全国 · 演示',
            demo: true,
            onCity: () => { window.location.href = './bi-city-meeting.html' },
            onRefresh: () => {
              snapshot.value = meetingFixture()
            },
            onClose: () => {
              open.value = false
            },
            onMonth: () => {
              snapshot.value = meetingFixture()
            },
            'onOpen-report': () => {
              window.alert('这是设计验证页。正式页面将进入对应的业务报表，并沿用统计范围。')
            },
          })
        : h(
            'button',
            {
              onClick: () => {
                open.value = true
              },
            },
            '重新打开会议大屏（演示数据）',
          )
  },
}).mount('#app')
