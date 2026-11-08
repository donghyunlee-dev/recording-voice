export interface StoryScene {
  title: string
  image: string
  imageAlt: string
  narration: string[]
}

export interface Storybook {
  id: string
  title: string
  summary: string
  scenes: StoryScene[]
}

export const storybooks: Storybook[] = [
  {
    id: 'snow-white',
    title: '백설공주',
    summary: '숲속 오두막에서 만난 친구들과 백설공주의 이야기예요.',
    scenes: [
      {
        title: '숲속의 새 친구들',
        image: '/storybook/snow-white-01-kawaii.webp',
        imageAlt: '파스텔 숲속 오두막에서 일곱 친구와 인사하는 백설공주',
        narration: ['깊은 숲에서 길을 잃은 백설공주는 작은 오두막을 발견했어요.', '오두막에는 일곱 난쟁이가 살고 있었고, 백설공주는 새 친구들을 만났지요.'],
      },
      {
        title: '수상한 사과',
        image: '/storybook/snow-white-02-kawaii.webp',
        imageAlt: '미소 짓는 할머니가 백설공주에게 빨간 사과를 건네는 모습',
        narration: ['왕비는 할머니로 변장해 백설공주에게 빨간 사과를 건넸어요.', '사과를 먹은 백설공주는 깊은 잠에 빠지고 말았어요.'],
      },
      {
        title: '다시 만난 친구들',
        image: '/storybook/snow-white-03-kawaii.webp',
        imageAlt: '눈을 뜬 백설공주와 기뻐하는 일곱 친구',
        narration: ['난쟁이들은 백설공주 곁을 지키며 슬퍼했어요.', '마침내 백설공주는 눈을 떴고 친구들과 오래오래 행복하게 지냈답니다.'],
      },
    ],
  },
  {
    id: 'three-pigs',
    title: '아기 돼지 삼형제',
    summary: '서로 힘을 모아 늑대의 바람을 이겨내는 삼형제 이야기예요.',
    scenes: [
      {
        title: '세 형제의 새집',
        image: '/storybook/three-pigs-01-kawaii.webp',
        imageAlt: '엄마 돼지의 배웅을 받으며 길을 떠나는 아기 돼지 삼형제',
        narration: ['아기 돼지 삼형제는 각자 살 집을 찾아 길을 떠났어요.', '첫째는 짚으로, 둘째는 나무로, 셋째는 벽돌로 집을 지었지요.'],
      },
      {
        title: '늑대의 커다란 입김',
        image: '/storybook/three-pigs-02-kawaii.webp',
        imageAlt: '살짝 바람을 불어 짚을 날리는 순한 늑대와 안전하게 달리는 아기 돼지들',
        narration: ['배고픈 늑대가 짚집 앞에서 후 하고 바람을 불었어요.', '짚집이 날아가자 첫째 돼지는 둘째의 나무집으로 달려갔어요.'],
      },
      {
        title: '튼튼한 벽돌집',
        image: '/storybook/three-pigs-03-kawaii.webp',
        imageAlt: '벽돌집을 함께 짓고 늑대와 사과를 나누는 아기 돼지 삼형제',
        narration: ['형제들은 튼튼한 벽돌집에 모여 힘을 합쳤어요.', '늑대는 집을 무너뜨리지 못하고 돌아갔고, 삼형제는 서로를 도우며 살았답니다.'],
      },
    ],
  },
  {
    id: 'red-riding-hood',
    title: '빨간 모자',
    summary: '할머니를 만나러 가는 빨간 모자의 숲길 이야기예요.',
    scenes: [
      {
        title: '숲에서 만난 늑대',
        image: '/storybook/red-riding-hood-01-kawaii.webp',
        imageAlt: '꽃이 핀 숲길에서 빨간 모자와 다정하게 인사하는 늑대',
        narration: ['빨간 모자는 아픈 할머니께 드릴 바구니를 들고 숲길을 걸었어요.', '길에서 만난 늑대는 할머니 집이 어디인지 물어보았지요.'],
      },
      {
        title: '할머니 집 앞에서',
        image: '/storybook/red-riding-hood-02-kawaii.webp',
        imageAlt: '따뜻한 오두막 문을 두드리는 빨간 모자',
        narration: ['늑대는 먼저 할머니 집에 도착해 문을 두드렸어요.', '잠시 뒤 빨간 모자도 할머니 집 문 앞에 도착했답니다.'],
      },
      {
        title: '할머니를 구한 용기',
        image: '/storybook/red-riding-hood-03-kawaii.webp',
        imageAlt: '할머니와 빨간 모자가 차를 마시고 창밖에서 늑대가 손을 흔드는 모습',
        narration: ['빨간 모자는 침대에 누운 늑대의 모습을 보고 이상하다고 느꼈어요.', '큰 소리로 도움을 청해 할머니와 무사히 만났고, 다음부터는 약속한 길로 다녔답니다.'],
      },
    ],
  },
]

export function storyScript(story: Storybook): string {
  return story.scenes.flatMap((scene) => scene.narration).join('\n')
}
