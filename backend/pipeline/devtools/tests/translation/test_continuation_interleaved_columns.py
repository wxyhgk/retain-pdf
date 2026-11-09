from retainpdf_translation.services.continuation.state import annotate_continuation_context
from retainpdf_translation.core.orchestration.units import finalize_orchestration_metadata_by_page
from retainpdf_translation.core.payload.parts.units import pending_translation_items


def body(item_id, text, zone, y):
    x = 20 if zone == 'left_column' else 300
    return dict(item_id=item_id, page_idx=0, block_idx=0, block_type='text',
                block_class='body', layout_role='paragraph', semantic_role='body',
                structure_role='body', source_text=text, protected_source_text=text,
                bbox=[x,y,x+240,y+50], layout_mode='double', layout_zone=zone)


def test_interleaved_columns_use_reading_order_without_reordering_payload():
    first = body('first', 'An unrelated complete paragraph.', 'left_column', 20)
    tail = body('tail', 'The coefficients determine the effects of', 'left_column', 500)
    head = body('head', 'the descriptors on the loss function.', 'right_column', 20)
    last = body('last', 'Another complete paragraph.', 'right_column', 500)
    payload = [first, head, tail, last]
    annotate_continuation_context(payload)
    assert tail['continuation_group'] == head['continuation_group'] != ''
    assert not first['continuation_group']
    assert not last['continuation_group']
    finalize_orchestration_metadata_by_page({0:payload})
    units = pending_translation_items(list(reversed(payload)))
    group = next(unit for unit in units if unit['translation_unit_kind']=='group')
    assert group['translation_unit_member_ids']==['tail','head']
    assert 'effects of the descriptors' in group['protected_source_text']
    assert [item['item_id'] for item in payload]==['first','head','tail','last']


def test_author_email_is_not_a_continuation_candidate():
    author = body('author', 'An Author University author@example.org', 'right_column', 10)
    tail = body('tail', 'Both definitions are affected by', 'left_column', 500)
    head = body('head', 'how well people understand a model.', 'right_column', 100)
    annotate_continuation_context([tail,author,head])
    assert not author['continuation_group']
    assert tail['continuation_group']==head['continuation_group']!=''
