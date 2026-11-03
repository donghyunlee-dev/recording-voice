export interface StoryScene {
  title: string
  image: string
  imageAlt: string
  narration: string[]
  imageSource: string
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
        image: '/storybook/snow-white-01.jpg',
        imageAlt: '백설공주 이야기의 옛 삽화',
        narration: ['깊은 숲에서 길을 잃은 백설공주는 작은 오두막을 발견했어요.', '오두막에는 일곱 난쟁이가 살고 있었고, 백설공주는 새 친구들을 만났지요.'],
        imageSource: 'https://commons.wikimedia.org/wiki/File:Snow_White_and_the_Seven_Dwarfs_1.jpg',
      },
      {
        title: '수상한 사과',
        image: '/storybook/snow-white-02.png',
        imageAlt: '사과를 건네는 왕비의 옛 삽화',
        narration: ['왕비는 할머니로 변장해 백설공주에게 빨간 사과를 건넸어요.', '사과를 먹은 백설공주는 깊은 잠에 빠지고 말았어요.'],
        imageSource: 'https://commons.wikimedia.org/wiki/File:Snow_White_Poisoned_Apple.png',
      },
      {
        title: '다시 만난 친구들',
        image: '/storybook/snow-white-03.png',
        imageAlt: '잠든 백설공주 곁을 지키는 친구들의 옛 삽화',
        narration: ['난쟁이들은 백설공주 곁을 지키며 슬퍼했어요.', '마침내 백설공주는 눈을 떴고 친구들과 오래오래 행복하게 지냈답니다.'],
        imageSource: 'https://commons.wikimedia.org/wiki/File:Snow_White_Coffin_Carried.png',
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
        image: '/storybook/three-pigs-01.jpg',
        imageAlt: '엄마 돼지와 아기 돼지들의 옛 삽화',
        narration: ['아기 돼지 삼형제는 각자 살 집을 찾아 길을 떠났어요.', '첫째는 짚으로, 둘째는 나무로, 셋째는 벽돌로 집을 지었지요.'],
        imageSource: 'https://commons.wikimedia.org/wiki/File:Three_little_pigs_and_mother_sow_-_Project_Gutenberg_eText_15661.jpg',
      },
      {
        title: '늑대의 커다란 입김',
        image: '/storybook/three-pigs-02.jpg',
        imageAlt: '늑대가 짚집을 날려 보내는 아기 돼지 삼형제 삽화',
        narration: ['배고픈 늑대가 짚집 앞에서 후 하고 바람을 불었어요.', '짚집이 날아가자 첫째 돼지는 둘째의 나무집으로 달려갔어요.'],
        imageSource: 'https://commons.wikimedia.org/wiki/File:Three_little_pigs_1904_straw_house.jpg',
      },
      {
        title: '튼튼한 벽돌집',
        image: '/storybook/three-pigs-03.jpg',
        imageAlt: '벽돌집을 짓는 셋째 돼지의 옛 삽화',
        narration: ['형제들은 튼튼한 벽돌집에 모여 힘을 합쳤어요.', '늑대는 집을 무너뜨리지 못하고 돌아갔고, 삼형제는 서로를 도우며 살았답니다.'],
        imageSource: 'https://commons.wikimedia.org/wiki/File:Three_little_pigs_-_third_pig_builds_a_house_-_Project_Gutenberg_eText_15661.jpg',
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
        image: '/storybook/red-riding-hood-01.jpg',
        imageAlt: '숲길에서 늑대를 만난 빨간 모자의 옛 삽화',
        narration: ['빨간 모자는 아픈 할머니께 드릴 바구니를 들고 숲길을 걸었어요.', '길에서 만난 늑대는 할머니 집이 어디인지 물어보았지요.'],
        imageSource: 'https://commons.wikimedia.org/wiki/File:Little_Red_Riding_Hood_Meeting_the_Wolf.jpg',
      },
      {
        title: '할머니 집 앞에서',
        image: '/storybook/red-riding-hood-02.jpg',
        imageAlt: '할머니 집 문을 두드리는 빨간 모자의 옛 삽화',
        narration: ['늑대는 먼저 할머니 집에 도착해 문을 두드렸어요.', '잠시 뒤 빨간 모자도 할머니 집 문 앞에 도착했답니다.'],
        imageSource: 'https://commons.wikimedia.org/wiki/File:Little_Red_Riding_Hood_Knocking_at_Her_Grandmother%E2%80%99s_Door.jpg',
      },
      {
        title: '할머니를 구한 용기',
        image: '/storybook/red-riding-hood-03.jpg',
        imageAlt: '침대에 누운 늑대를 바라보는 빨간 모자의 옛 삽화',
        narration: ['빨간 모자는 침대에 누운 늑대의 모습을 보고 이상하다고 느꼈어요.', '큰 소리로 도움을 청해 할머니와 무사히 만났고, 다음부터는 약속한 길로 다녔답니다.'],
        imageSource: 'https://commons.wikimedia.org/wiki/File:Little_Red_Riding_Hood%E2%80%94So_She_Went_to_the_Bedside.jpg',
      },
    ],
  },
]

export function storyScript(story: Storybook): string {
  return story.scenes.flatMap((scene) => scene.narration).join('\n')
}
