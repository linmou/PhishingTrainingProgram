/**
 * Tests simplifiedAIContext.ts: full chronological history retrieval, cursor pagination,
 * failure propagation, scenario setup and stored message role formatting.
 */

import { buildAIContextFromExistingData } from '../simplifiedAIContext';
import { supabase } from '../supabase';
import { assessmentResultMessage, deliveredAnswerRow, deliveredQuestionRow } from '../../test-support/transferRoomFixtures';
import {transferAssessmentService} from '../transferAssessmentService';

jest.mock('../supabase', () => ({ supabase: { from: jest.fn() } }));
jest.mock('../transferAssessmentService',()=>({transferAssessmentService:{readReview:jest.fn().mockResolvedValue({history_readiness:{
  ready:true,result_message_ids:[],handled_answer_message_ids:[],pending_answer_message_ids:[],unavailable_assessment_ids:[],
}})}}));

type Message = {
  id: string;
  content: string;
  user_role: string;
  response_mode: string | null;
  created_at: string;
};

const room = {
  title: 'Phishing Email Detection Training',
  description: 'Learn to identify suspicious emails',
  pre_populated_dialogue: null,
  created_at: '2024-01-15T10:00:00Z'
};

function mockRoom(data: object | null = room, error: object | null = null) {
  (supabase.from as jest.Mock).mockReturnValueOnce({
    select: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({ data, error })
      })
    })
  });
}

function mockPage(data: Message[] | null, error: object | null = null) {
  const query = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    or: jest.fn().mockReturnThis(),
    range: jest.fn().mockResolvedValue({ data, error })
    ,in:jest.fn().mockResolvedValue({data,error})
  };
  (supabase.from as jest.Mock).mockReturnValueOnce(query);
  return query;
}

function messages(count: number): Message[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `00000000-0000-0000-0000-${String(index).padStart(12, '0')}`,
    content: `message ${index}`,
    user_role: index % 2 === 0 ? 'tutor' : 'student',
    response_mode: null,
    created_at: new Date(Date.parse(room.created_at) + index * 1000).toISOString()
  }));
}

describe('buildAIContextFromExistingData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (transferAssessmentService.readReview as jest.Mock).mockResolvedValue({history_readiness:{
      ready:true,result_message_ids:[],handled_answer_message_ids:[],pending_answer_message_ids:[],unavailable_assessment_ids:[],
    }});
  });

  it('keeps scenario, valid pre-populated posts and chat role formatting', async () => {
    mockRoom({
      ...room,
      pre_populated_dialogue: {
        posts: [
          { content: 'Email from bank: verify immediately' },
          { text: 'SMS message: claim your prize' },
          { content: null },
          { other: 'Invalid post structure' }
        ]
      }
    });
    mockPage([
      { ...messages(1)[0], content: 'Student question', user_role: 'student' },
      { ...messages(1)[0], id:'second', content: 'Tutor explanation', user_role: 'tutor' },
      { ...messages(1)[0], id:'third', content: 'Observer note', user_role: 'observer' }
    ]);
    mockPage([]);

    const context = await buildAIContextFromExistingData('room');
    expect(context).toHaveLength(8);
    expect(context[0]).toMatchObject({ role: 'system' });
    expect(context[0].content).toContain(room.title);
    expect(context[0].content).toContain(room.description);
    expect(context[1].content).toContain('Student shared for analysis');
    expect(context[1].content).toContain('verify immediately');
    expect(context[2].content).toContain('claim your prize');
    expect(context.slice(3, 5).map(message => message.content)).toEqual([
      'Student shared for analysis: ',
      'Student shared for analysis: '
    ]);
    expect(context.slice(5).map(({ role, content }) => ({ role, content }))).toEqual([
      { role: 'user', content: 'Student: Student question' },
      { role: 'assistant', content: 'Tutor: Tutor explanation' },
      { role: 'user', content: 'Observer: Observer note' }
    ]);
  });

  it('includes all 24 saved turns, with the latest instruction and reply adjacent', async () => {
    const history = messages(24);
    history[22].content = 'Check whether the shortened link leads to Apple.';
    history[23].content = 'Looks like it does';
    mockRoom();
    const page = mockPage(history);
    mockPage([]);

    const context = await buildAIContextFromExistingData('real-room');
    expect(context).toHaveLength(25);
    expect(context.slice(1).map(message => message.content)).toEqual(
      history.map(message => `${message.user_role === 'tutor' ? 'Tutor' : 'Student'}: ${message.content}`)
    );
    expect(context.slice(-2).map(message => message.content)).toEqual([
      'Tutor: Check whether the shortened link leads to Apple.',
      'Student: Looks like it does'
    ]);
    expect(page.order.mock.calls).toEqual([
      ['created_at', { ascending: true }],
      ['id', { ascending: true }]
    ]);
    expect(page.eq).toHaveBeenCalledWith('room_id', 'real-room');
  });

  it.each([1000, 1007])('loads %i messages once, including an exact page boundary', async count => {
    const history = messages(count);
    mockRoom();
    const first = mockPage(history.slice(0, 1000));
    const second = mockPage(history.slice(1000));
    const last = count > 1000 ? mockPage([]) : second;

    const context = await buildAIContextFromExistingData('long-room');
    expect(context).toHaveLength(count + 1);
    expect(new Set(context.slice(1).map(message => message.content)).size).toBe(count);
    expect(context.slice(1).map(message => message.timestamp)).toEqual(
      history.map(message => new Date(message.created_at).getTime() / 1000)
    );
    expect(first.range).toHaveBeenCalledWith(0, 999);
    expect(second.range).toHaveBeenCalledWith(0, 999);
    expect(second.or).toHaveBeenCalledWith(
      `created_at.gt.${history[999].created_at},and(created_at.eq.${history[999].created_at},id.gt.${history[999].id})`
    );
    expect(last.range).toHaveBeenCalledWith(0, 999);
  });

  it('continues after a server returns fewer rows than the requested page size', async () => {
    const history = messages(24);
    mockRoom();
    mockPage(history.slice(0, 10));
    const second = mockPage(history.slice(10));
    const last = mockPage([]);

    const context = await buildAIContextFromExistingData('capped-room');
    expect(context).toHaveLength(25);
    expect(second.range).toHaveBeenCalledWith(0, 999);
    expect(second.or).toHaveBeenCalledWith(
      `created_at.gt.${history[9].created_at},and(created_at.eq.${history[9].created_at},id.gt.${history[9].id})`
    );
    expect(last.range).toHaveBeenCalledWith(0, 999);
  });

  it('keeps later rows when an earlier row is deleted between pages with matching timestamps', async () => {
    const history = messages(6).map(message => ({ ...message, created_at: room.created_at }));
    let stored = [...history];
    const queries: Array<ReturnType<typeof mockPage>> = [];
    mockRoom();
    (supabase.from as jest.Mock).mockImplementation(() => {
      const query = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        range: jest.fn()
      };
      query.range.mockImplementation((start: number, end: number) => {
        const filter: string | undefined = query.or.mock.calls[0]?.[0];
        const cursor = filter?.match(/^created_at.gt.([^,]+),and\(created_at.eq.[^,]+,id.gt.([^)]*)\)$/);
        const eligible = cursor ? stored.filter(message =>
          message.created_at > cursor[1] ||
          (message.created_at === cursor[1] && message.id > cursor[2])
        ) : stored;
        const data = eligible.slice(start, Math.min(end + 1, start + 2));
        if (queries.length === 1) stored = stored.slice(1);
        return Promise.resolve({ data, error: null });
      });
      queries.push(query);
      return query;
    });

    const context = await buildAIContextFromExistingData('changing-room');
    expect(context.slice(1).map(message => message.content)).toEqual(history.map(message =>
      `${message.user_role === 'tutor' ? 'Tutor' : 'Student'}: ${message.content}`
    ));
    expect(queries[0].or).not.toHaveBeenCalled();
    expect(queries[1].or).toHaveBeenCalledWith(
      `created_at.gt.${room.created_at},and(created_at.eq.${room.created_at},id.gt.${history[1].id})`
    );
    expect(queries).toHaveLength(4);
  });

  it('preserves scenario and pre-populated dialogue when no saved messages exist', async () => {
    mockRoom({ ...room, pre_populated_dialogue: { posts: [{ content: 'Example post' }] } });
    mockPage([]);
    const context = await buildAIContextFromExistingData('empty-room');
    expect(context).toHaveLength(2);
    expect(context[1].content).toContain('Example post');
  });

  it('preserves simulated participant identity without turning it into learner evidence', async () => {
    mockRoom();
    mockPage([
      { ...messages(1)[0], content: '[agent:riley] Participant comment', response_mode: 'multiagent' },
      { ...messages(1)[0], id:'second', content: '[agent:tutor] Tutor comment', response_mode: 'multiagent' },
      { ...messages(1)[0], id:'third', content: '[agent:riley] Learner typed tag', user_role: 'student', response_mode: 'multiagent' }
    ]);
    mockPage([]);
    const context = await buildAIContextFromExistingData('multiagent-room');
    expect(context.slice(1).map(({ role, content }) => ({ role, content }))).toEqual([
      { role: 'assistant', content: 'Simulated AI participant Riley: Participant comment' },
      { role: 'assistant', content: 'AI Tutor: Tutor comment' },
      { role: 'user', content: 'Student: [agent:riley] Learner typed tag' }
    ]);
  });

  it.each([false, true])('rejects page errors instead of returning partial history (later page: %s)', async later => {
    const error = { message: 'Messages unavailable' };
    mockRoom();
    if (later) mockPage(messages(24));
    mockPage(null, error);
    await expect(buildAIContextFromExistingData('error-room')).rejects.toEqual(error);
  });

  it('rejects room lookup errors before fetching messages', async () => {
    const error = { message: 'Room not found', code: 'PGRST116' };
    mockRoom(null, error);
    await expect(buildAIContextFromExistingData('missing-room')).rejects.toEqual(error);
    expect(supabase.from).toHaveBeenCalledTimes(1);
  });

  it('packages saved question options, learner answer and trusted result in causal dialogue order', async () => {
    const result = assessmentResultMessage('retry',1,deliveredAnswerRow.id);
    mockRoom();
    mockPage([{...result,created_at:'2020-01-01T00:00:00Z'},deliveredAnswerRow,deliveredQuestionRow] as Message[]);
    mockPage([]);
    const context = await buildAIContextFromExistingData('room',[result.id]);
    expect(context).toHaveLength(4);
    expect(context[1].content).toContain(deliveredQuestionRow.content);
    deliveredQuestionRow.assessment_options.forEach(option => expect(context[1].content).toContain(`${option.id}. ${option.text}`));
    expect(context[2].content).toContain(`answer ${deliveredAnswerRow.id}`);
    expect(context[3].content).toContain(result.id);
    expect(context[3].content).toContain(deliveredAnswerRow.user_id);
    expect(context[3].content).toContain(result.content);
  });

  it('refuses incomplete saved result history before returning provider context', async () => {
    mockRoom(); mockPage([deliveredAnswerRow] as Message[]); mockPage([]);mockPage([]);
    await expect(buildAIContextFromExistingData('room',['missing-result'])).rejects.toThrow('ASSESSMENT_RESULT_UNAVAILABLE');
  });

  it('reads private readiness in disabled transfer rooms and identifies a handled response as unscored',async ()=>{
    mockRoom({...room,transfer_learning_enabled:false});mockPage([deliveredQuestionRow,deliveredAnswerRow] as Message[]);mockPage([]);
    (transferAssessmentService.readReview as jest.Mock).mockResolvedValueOnce({history_readiness:{ready:true,result_message_ids:[],
      handled_answer_message_ids:[deliveredAnswerRow.id],pending_answer_message_ids:[],unavailable_assessment_ids:[]}});
    const context=await buildAIContextFromExistingData('room',[],deliveredAnswerRow.user_id);
    expect(transferAssessmentService.readReview).toHaveBeenCalledWith('room',deliveredAnswerRow.assessment_id);
    expect(context[2].content).toContain('Unscored assessment response');
    expect(context[2].content).not.toContain('Correct.');
  });

  it('omits another learner unfinished answer without blocking the focused learner',async ()=>{
    const result=assessmentResultMessage('passed',1,deliveredAnswerRow.id);
    mockRoom();mockPage([deliveredQuestionRow,deliveredAnswerRow,result,
      {...deliveredAnswerRow,id:'unrelated-pending',user_id:'other-learner',assessment_id:'other-assessment',content:'Other unfinished answer'}] as Message[]);mockPage([]);
    const context=await buildAIContextFromExistingData('room',[],deliveredAnswerRow.user_id);
    expect(context.map(message=>message.content).join('\n')).not.toContain('Other unfinished answer');
    expect(context[3].content).toContain('lifecycle passed');
    expect(context[3].content).toContain('progress deferred false');
  });

  it('fails missing public options even in a disabled transfer room',async ()=>{
    mockRoom({...room,transfer_learning_enabled:false});
    mockPage([{...deliveredQuestionRow,assessment_options:null}, {...deliveredAnswerRow,assessment_id:null}] as Message[]);mockPage([]);
    await expect(buildAIContextFromExistingData('room',[],deliveredAnswerRow.user_id)).rejects.toThrow('Assessment question options are incomplete');
    expect(transferAssessmentService.readReview).toHaveBeenCalledWith('room',deliveredQuestionRow.assessment_id);
  });

  it('fetches the exact result messages committed by trusted read recovery after history was read',async ()=>{
    const result=assessmentResultMessage('passed',1,deliveredAnswerRow.id);
    mockRoom();mockPage([deliveredQuestionRow,deliveredAnswerRow] as Message[]);mockPage([]);
    const catchup=mockPage([result] as Message[]);
    (transferAssessmentService.readReview as jest.Mock).mockResolvedValueOnce({history_readiness:{ready:true,result_message_ids:[result.id],
      pending_answer_message_ids:[],unavailable_assessment_ids:[]}});
    const context=await buildAIContextFromExistingData('room',[],deliveredAnswerRow.user_id);
    expect(catchup.in).toHaveBeenCalledWith('id',[result.id]);
    expect(context[3].content).toContain(result.id);
  });
});
